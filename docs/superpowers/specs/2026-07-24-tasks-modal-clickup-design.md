# Spec: Modal de detalhe da Task no estilo do modal de Conteúdos, adaptado pro ClickUp

Branch: a definir (ver decisão 1 abaixo). Repo `/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost`.

## Contexto

Em outra conversa, o Victor evoluiu bastante o modal de detalhe de card da página Conteúdos (`ContentCardModal.tsx`): virou um editor completo — layout de 2 colunas (conteúdo à esquerda, comentários/atividade à direita), capa de imagem, campos editáveis (labels, membros, descrição, anexos com upload, checklist), tudo escrevendo de volta no Trello. O card do board (`ContentCard.tsx`) e o board (`ContentBoard.tsx`) também ficaram no estilo visual do Trello real. Essa parte está pronta e aprovada — **fora de escopo deste documento**.

Nessa mesma conversa, o card do board de Tasks (`TaskCard.tsx`) já foi criado espelhando o estilo visual de `ContentCard.tsx` (commit `88dfc46`). O que falta é o **modal de detalhe da task** (`TaskDetailModal.tsx`), que continua no formato antigo (single-column, só-leitura, sem o visual novo).

Investigação feita antes do design, usando o token real do app (`CLICKUP_API_TOKEN` em `.env.local`) contra os 6 clientes:

- **Uso real de campos do ClickUp hoje** (~37 tasks reais, 6 clientes): checklist, tags, prioridade, descrição e anexos estão vazios em 100% das tasks. Responsável, data prevista e status são usados de verdade (ex.: Laís tem 12/14 tasks com responsável, 9/14 com data; todas as listas têm tasks em múltiplos status reais).
- Isso é bem diferente do Trello, onde labels/anexos/capa têm uso real — por isso a decisão de escopo abaixo (ver decisões).
- Confirmei ao vivo dois endpoints de leitura necessários pro design: `GET /list/{listId}` devolve os status configurados da lista (`statuses: [{status, color, orderindex}]`) e `GET /list/{listId}/member` devolve os membros da lista (`{id, username, color, initials, profilePicture}`).
- **Achado importante**: um status real (`"não iniciado"`) devolve `color: "var(--cu-status-open)"` — uma variável CSS interna do ClickUp, não um hex válido. Precisa de fallback pra cor neutra, igual já existe pro Trello (`trelloColorToHex`).
- Endpoints de escrita (não testados ao vivo pra não alterar dado real de cliente, mas documentados e estáveis na API v2 do ClickUp): `PUT /task/{id}` aceita `status`, `description`, `due_date` (`null` pra limpar) e `assignees: {add: [...], rem: [...]}` como campos independentes no corpo. `GET /task/{id}/comment` e `POST /task/{id}/comment` (corpo `{comment_text}`) pros comentários.

## Decisões (via brainstorming com o Victor)

1. **Branch**: a decidir na hora de escrever o plano — como o trabalho anterior (capa/board Trello) foi feito por outra conversa diretamente na `feature-conteudos-refinamento` sem passar pelo processo de spec/plano, e essa branch nunca foi mesclada, ela já é a base mais atual do repo. Este trabalho continua nela.
2. **Escopo funcional**: replica o visual novo (2 colunas, campos com editor) **e** a capacidade de escrita real no ClickUp — mas só pros 3 campos que a equipe realmente usa hoje: **status**, **responsáveis** e **data prevista**. Descrição e comentários também ficam editáveis (úteis mesmo sem uso histórico — comentário é uma ferramenta de comunicação, não um dado que "já deveria estar preenchido"). **Prioridade, tags e tempo continuam só-leitura** (como já são hoje) — sem checklist nem anexos no modal de Tasks (não existem no modelo de dados atual do ClickUp usado aqui, e 0% de uso real não justifica construir).
3. **Sem capa de imagem, sem lightbox** — ClickUp não tem o conceito de "capa" que o Trello tem; esses elementos do modal de Conteúdos não têm equivalente aqui.
4. **Sem "atividade" tipo Trello** — só comentários reais (postar + listar), sem tentar espelhar um feed de atividade do ClickUp (mais complexo, não pedido).
5. **Board/card de Tasks não muda** — `TaskCard.tsx`/`TasksTable.tsx` já foram ajustados numa conversa anterior; este documento cobre só o modal.

## Arquitetura

- **`src/lib/clickup.ts`**: ganha `TaskStatus = { status: string; color: string; orderindex: number }`, `TaskListMember = { id: string; name: string; color: string; initials: string; avatarUrl?: string }`, `fetchListMeta(listId): Promise<{ statuses: TaskStatus[]; members: TaskListMember[] }>` (2 chamadas em paralelo). Funções de escrita: `updateTaskStatus(taskId, status)`, `addTaskAssignee(taskId, memberId)`, `removeTaskAssignee(taskId, memberId)`, `updateTaskDueDate(taskId, date: number | null)`, `updateTaskDescription(taskId, desc: string)`, `fetchTaskComments(taskId)`, `postTaskComment(taskId, text)`. Cor de status inválida (não começa com `#`) cai num cinza neutro, mesmo padrão do `trelloColorToHex`.
- **Rotas novas**, todas seguindo o padrão de auth (`verifyClientToken`, `hasClickUpCredentials`) já usado em `/api/tasks/[client]/route.ts`:
  - `GET /api/tasks/[client]/list-meta` — status + membros da lista do cliente.
  - `POST /api/tasks/[client]/task/[taskId]/status` — corpo `{ status }`.
  - `POST /api/tasks/[client]/task/[taskId]/assignees` / `DELETE` — corpo `{ memberId }`.
  - `POST /api/tasks/[client]/task/[taskId]/due-date` — corpo `{ dueDate: number | null }`.
  - `POST /api/tasks/[client]/task/[taskId]/description` — corpo `{ desc }`.
  - `GET /api/tasks/[client]/task/[taskId]/comments` / `POST` — corpo `{ text }` pro POST.
- **`clientId`/`accessKey`** passam a descer de `TasksPageClient.tsx` → `TasksTable.tsx` → `TaskCard.tsx`/`TaskDetailModal.tsx` (hoje só `TasksPageClient` os tem) — mesma mudança de plumbing já feita em Conteúdos quando a capa foi adicionada.

## Componentes

- **`TaskDetailModal.tsx`** (reescrita completa, mesmo layout 2 colunas do `ContentCardModal.tsx`, sem capa/lightbox/checklist/anexos):
  - Header: título da task + botão de fechar (sem badge de lista — Tasks não tem um campo equivalente ao `listName` do Trello).
  - Coluna principal (scroll próprio, mini-header fixo ao rolar): **Status** (pill colorido clicável, abre dropdown com os status da lista — clicar num status troca na hora, sem múltipla seleção), **Responsáveis** (avatares + botão "+", dropdown com membros da lista, toggle como no Trello), **Data prevista** (texto + botão "Editar" que vira um `<input type="date">` nativo — sem lib de date picker), **Prioridade** (só-leitura, como hoje), **Tags** (só-leitura, como hoje), **Tempo** (só-leitura, como hoje), **Descrição** (texto + botão "Editar" que vira textarea, mesmo padrão do `DescriptionField` de Conteúdos, sem markdown — ClickUp aqui usa texto plano).
  - Coluna lateral: **Comentários** — campo de novo comentário + lista dos existentes (autor, avatar, texto, data relativa), sem seção de "atividade" misturada.
- **`TaskCard.tsx`/`TasksTable.tsx`**: sem mudança — já ajustados.

## Fluxo de dados

1. `TasksPageClient` busca `/api/tasks/[client]` (sem mudança) e passa `clientId`/`accessKey` adiante.
2. Ao abrir um card, `TaskDetailModal` busca `/api/tasks/[client]/list-meta` (status + membros) só quando o dropdown de Status ou Responsáveis é aberto pela primeira vez (mesmo padrão lazy do `board-meta` de Conteúdos) e `/api/tasks/[client]/task/[taskId]/comments` ao montar.
3. Cada edição (status, responsável, data, descrição, comentário) chama a rota correspondente e atualiza o estado local otimisticamente, revertendo em caso de erro (mesmo padrão do `ContentCardModal`).

## Tratamento de erros

- Falha ao buscar status/membros/comentários → mensagem inline curta ("Não foi possível carregar."), sem travar o resto do modal.
- Falha ao salvar uma edição (status/responsável/data/descrição) → reverte o estado otimista pro valor anterior, sem mensagem de erro persistente (mesmo padrão do `ContentCardModal`, que já reverte silenciosamente em alguns casos e mostra erro pontual em outros — seguir o padrão campo a campo já estabelecido lá).
- Autenticação: mesmo padrão já existente (token inválido → `AccessDenied` na página; rota de API → 401).

## Testes / verificação

Sem suíte automatizada (padrão já estabelecido). Verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual: abrir uma task de cada um de 2 clientes diferentes (ex.: Laís — tem responsável/data reais — e Débora), trocar o status, adicionar/remover um responsável, editar a data, editar a descrição, postar um comentário — confirmar que cada mudança reflete no ClickUp de verdade (conferir direto na lista, já que a escrita é real) e que a UI atualiza sem recarregar a página.

## Fora de escopo (explícito)

- Checklist e anexos no modal de Tasks (0% de uso real, sem equivalente pronto no modelo de dados atual).
- Capa de imagem / lightbox (sem conceito equivalente no ClickUp usado aqui).
- Feed de "atividade" (só comentários reais).
- Qualquer mudança no `TaskCard.tsx`/`TasksTable.tsx` (já ajustados em conversa anterior).
- Editar prioridade, tags ou tempo (continuam só-leitura).
