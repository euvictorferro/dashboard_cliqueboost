# Spec: Página Tasks + Sidebar de navegação

Branch: `feature-tasks-clickup`. Item #2 do roadmap Fase A (`docs/superpowers/ROADMAP-plataforma.md`).

## Contexto

Hoje o dashboard é single-page: tudo mora em `/[client]`, sem navegação nenhuma. Essa spec adiciona a primeira página irmã do Dashboard — uma tela "Tasks" — e a sidebar necessária pra navegar entre elas.

Decisão importante (mudou o escopo original do roadmap, confirmada com o Victor): a equipe da Clique Boost **não vai ganhar um painel admin nessa fase** — ela continua gerenciando tarefas direto no ClickUp, como já faz hoje. A página Tasks do dashboard é **só leitura** pro cliente: espelha, em tempo real, a Lista do ClickUp do próprio cliente.

Estrutura já confirmada no ClickUp (Workspace → Booster Space → pasta "Clientes"): cada cliente tem uma Lista dedicada dentro dessa pasta, com 3 status (`to do`, `in progress`, `complete`). Mapeamento Lista → cliente:

| client.id | Nome da Lista no ClickUp | List ID |
|---|---|---|
| debora | Débora | 901714744652 |
| lais | Laís | 901714211778 |
| sam | Sam | 901711532887 |
| nelson | Nelson | 901711532905 |
| tiago | Tiago | 901713981087 |
| bela | Bela | 901711532881 |

Token de API do ClickUp já validado direto contra `GET /list/{id}/task` (retorna `name`, `status`, `due_date`, `assignees`, `description` num único call, sem N+1).

## Decisões (via brainstorming com o Victor)

1. **Permissão**: cliente só visualiza. Criação/edição de tasks continua sendo feita pela equipe no próprio ClickUp — não existe UI de escrita nessa v1.
2. **Colunas da tabela**: Nome, Status, Data prevista, Descrição, Responsável (nome de quem da equipe está cuidando).
3. **Formato**: tabela (não Kanban) — como o roadmap original descreveu.
4. **Fonte de dados**: busca ao vivo na API do ClickUp a cada carregamento da página Tasks, sem cache (volume baixo — 1 chamada por carregamento, sem loop de dias como nas métricas da Meta).
5. **Sidebar**: nova, com pelo menos "Dashboard" e "Tasks". Fica pronta pra receber mais itens no futuro (Conteúdos, Calls, Conta — outros itens do roadmap), mas só esses 2 são construídos agora.

## Arquitetura

- **`src/lib/clients.ts`**: cada `Client` ganha um campo opcional `clickupListId?: string`, preenchido pros 6 clientes reais conforme a tabela acima.
- **`src/lib/clickup.ts`** (novo, server-only — mesmo aviso de `meta.ts`: nunca importar de um componente `"use client"`):
  - `hasClickUpCredentials(): boolean` — checa `process.env.CLICKUP_API_TOKEN`.
  - `fetchClientTasks(listId: string): Promise<TaskItem[]>` — chama `GET https://api.clickup.com/api/v2/list/{listId}/task?include_closed=true` com header `Authorization: <token>`, mapeia a resposta crua pro tipo interno `TaskItem`.
- **`src/app/[client]/layout.tsx`** (novo): move a checagem de token (`verifyClientToken`) pra cá — hoje ela mora em `page.tsx`; com 2 páginas embaixo do mesmo `[client]`, checar 1 vez no layout evita duplicar a chamada ao Supabase. Se inválido, renderiza `<AccessDenied>` no lugar de `{children}` — nesse caso nenhuma page embaixo chega a renderizar. Se válido, renderiza `<Sidebar clientId={client.id} accessKey={key} />` + `{children}`.
  - Nota técnica: um layout do Next.js recebe `children` já como elemento pronto — não dá pra injetar props nele por herança direta. Por isso `client` (lookup síncrono em `CLIENTS`, sem custo) e `accessKey` (lido do próprio `searchParams` da page) são **recalculados de forma independente e barata em cada page**, sem repetir a chamada ao Supabase — essa só acontece uma vez, no layout.
- **`src/app/[client]/page.tsx`**: perde a checagem de token (já feita no layout), continua renderizando só `<Dashboard>`.
- **`src/app/[client]/tasks/page.tsx`** (novo): resolve `client` (via `CLIENTS.find`) e `accessKey` (via `searchParams`) do mesmo jeito que o Dashboard já faz hoje, e renderiza `<TasksTable>`.
- **`src/app/api/tasks/[client]/route.ts`** (novo): mesmo padrão de auth das outras rotas (`verifyClientToken`) → resolve `client.clickupListId` → chama `fetchClientTasks` → devolve JSON.

## Componentes

- **`Sidebar.tsx`** (novo): coluna fixa à esquerda, com os itens "Dashboard" (`/${clientId}?key=${accessKey}`) e "Tasks" (`/${clientId}/tasks?key=${accessKey}`). Destaca o item da rota ativa. A chave é sempre propagada nos links — sem ela o cliente perde o acesso ao trocar de página.
- **`TasksTable.tsx`** (novo): tabela com as 5 colunas da decisão #2.
  - Status em badge colorido — usa a cor exata que já vem no campo `status.color` da própria resposta do ClickUp (ex: `#87909e` pra "to do"), não uma cor fixa no código. Assim continua correto se a paleta mudar no ClickUp.
  - Ordenação: por `status.orderindex` (0, 1, 2 — vem da lista, não é hardcoded em português) e, dentro de cada grupo, por data prevista (mais próxima primeiro; sem data prevista vai por último).
  - Data prevista: `due_date` vem em epoch-ms ou `null` da API. Formata em `DD/MM/YYYY`; quando `null`, mostra "Sem prazo".
  - Responsável: `assignees` pode ter mais de uma pessoa — junta os nomes com vírgula (ex: "Victor Ferro, Leonardo Gualbino"). Sem ninguém atribuído, mostra "Sem responsável".

## Fluxo de dados

1. `layout.tsx` valida o token uma vez, passa `client` e `accessKey` pros filhos.
2. Página Tasks dispara `fetch(/api/tasks/${client.id}?key=${accessKey})` no carregamento (mesmo padrão de loading state "Atualizando…" já usado no Dashboard).
3. A rota resolve `client.clickupListId`, chama `fetchClientTasks`, devolve `TaskItem[]`.
4. `TasksTable` agrupa por status e ordena por data prevista dentro de cada grupo.

## Tratamento de erros

- Falha na chamada ao ClickUp → mensagem inline "Não foi possível carregar as tarefas agora." Sem fallback de mock (não existe um mock natural pra tarefas, diferente da Meta).
- Cliente sem `clickupListId` configurado → mensagem "Nenhuma lista de tarefas configurada pra esse cliente." (defensivo — os 6 clientes reais já têm o vínculo).
- Autenticação: mesmo padrão já existente (token inválido → `AccessDenied`).

## Testes / verificação

- Sem suíte automatizada no projeto (padrão já estabelecido) — verificação via `curl` direto na API do ClickUp (já validado nesta sessão) e checagem visual no Browser pane com um cliente real (ex: Laís, que já tem tasks reais na lista).

## Fora de escopo (explícito)

- Criação, edição ou exclusão de tasks pelo cliente (fica pro Painel Admin, item #7 do roadmap, ainda não construído).
- Visualização Kanban (fica pra página "Conteúdos", item #3 do roadmap — página diferente).
- Puxar de outras pastas/espaços do ClickUp além da Lista do próprio cliente.
- Sincronização em tempo real via webhook — é sempre busca ao vivo no carregamento da página.
