# Spec: Tabela de Tasks estilo ClickUp + reorganização do modal

Branch: `feature-conteudos-refinamento` (mesma branch em uso, ainda não mesclada). Repo `/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost`.

## Contexto

O Victor revisou o preview do modal de Tasks (recém-entregue no estilo 2 colunas do Conteúdos, com edição real no ClickUp) e pediu dois ajustes visuais, com prints reais do ClickUp como referência:

1. **Página Tasks**: hoje é um board estilo Kanban (colunas por status, cards empilhados — construído numa conversa anterior espelhando o visual do Trello). O pedido agora é reverter pra uma **tabela de verdade**, igual à visão de lista real do ClickUp: seções de status sempre visíveis (mesmo vazias), com ícone específico por tipo de status, e cada task numa linha com colunas Nome/Status/Data/Responsável/Prioridade.
2. **Modal de detalhe**: reorganizar os campos em pares (2 por linha) igual ao ClickUp real, com a Descrição vindo logo depois do grupo de campos compactos — antes só do painel de comentários.

Esse pedido inicial também incluía checklist, anexos, campos customizados, subtask e vínculos entre tasks — decompusermos em rounds separados (ver decisão 1). Este documento cobre só tabela + reorganização do modal.

Investigação feita antes do design, usando o token real do app (`CLICKUP_API_TOKEN`) contra a lista real da Débora:

- Cada status do ClickUp já devolve um campo `type`: `"open"`, `"custom"` ou `"closed"` — tanto na lista de status da lista (`GET /list/{id}`, já buscado por `fetchListMeta`) quanto embutido no status de cada task (`GET /list/{id}/task`, já buscado por `fetchClientTasks`). Não precisa de chamada nova — só adicionar o campo na leitura que já existe.
- Confirmado ao vivo: `"não iniciado"` → `type: "open"`, `"em andamento"` → `type: "custom"`, `"concluído"` → `type: "closed"` — mapeamento direto pros 3 ícones pedidos (bolinha tracejada / meia-lua / bolinha com check).
- `TaskPriority.color` já vem direto da API do ClickUp (não é um mapeamento nosso) — o ícone de bandeira só precisa usar essa cor, sem inventar uma paleta própria.

## Decisões (via brainstorming com o Victor)

1. **Escopo**: só tabela (com seções sempre visíveis + ícones de status + colunas) e reorganização do modal. Checklist, anexos, campos customizados, subtask e vínculos ficam para próximos rounds — nenhum botão decorativo pra essas features nesse round (não faz sentido um botão que não faz nada).
2. **Tabela substitui o board de cards**: `TaskCard.tsx` (board estilo Trello) deixa de ser usado na página Tasks — vira uma tabela real, com linhas compactas em vez de cards. `getDueDateDisplay` (`src/lib/dateDisplay.ts`) continua sendo usado só por `ContentCard.tsx` depois dessa mudança.
3. **Seções sempre visíveis**: usa a lista completa de status da lista (já buscável via `fetchListMeta`, que já existe) pra desenhar uma seção por status, mesmo com 0 tasks — não deriva mais os status só a partir das tasks presentes.
4. **Status na linha não é editável direto pela tabela** — clicar na linha inteira abre o modal (como já funciona hoje); a edição de status continua só dentro do modal. O pill de status na linha é só leitura.
5. **Modal**: grade de campos compactos primeiro — Status + Responsáveis numa linha, Datas + Prioridade em outra, Tempo numa linha própria, Tags abaixo — Descrição vem logo depois desse grupo, antes do painel de Comentários (que não muda).

## Arquitetura

- **`src/lib/clickup.ts`**: `TaskItem` ganha `statusType: "open" | "custom" | "closed"`, populado a partir de `t.status.type` (já vem na resposta de `GET /list/{id}/task`, sem chamada nova).
- **`src/app/api/tasks/[client]/route.ts`**: passa a buscar `fetchClientTasks` e `fetchListMeta` em paralelo (`Promise.all`), devolvendo `{ tasks, statuses }` em vez de só `{ tasks }` — a UI usa `statuses` (ordenados por `orderindex`) pra desenhar as seções sempre visíveis.
- **Componentes novos**:
  - `src/components/StatusIcon.tsx` — 3 variantes de ícone SVG por `type` (bolinha tracejada pra `open`, meia-lua preenchida pra `custom`, bolinha com check pra `closed`), cor vem de `task.statusColor` (já existe).
  - `src/components/PriorityFlag.tsx` — ícone de bandeira colorido com `priority.color`; não renderiza nada se `priority` for `null`.
  - `src/components/TaskRow.tsx` — substitui `TaskCard.tsx` como a unidade de linha da tabela (ícone de status + nome | status pill | data | avatar do responsável | bandeira de prioridade), clicável (abre o modal, mesmo padrão de `onClick` que `TaskCard` já tinha).
- **Removido**: `src/components/TaskCard.tsx` (sem uso restante depois da migração pra `TaskRow.tsx`).
- **`TasksTable.tsx`** (reescrita): recebe `statuses` além de `tasks`; agrupa tasks por status usando a lista completa de `statuses` (não só os presentes nas tasks); cada seção vira um cabeçalho (pill do status, como já é hoje) + uma mini-tabela com header de colunas (Nome/Status/Data/Responsável/Prioridade) + `TaskRow` por task, mesmo quando a seção está vazia (mostra só o cabeçalho de colunas, sem linhas).
- **`TaskDetailModal.tsx`**: reorganização de layout — sem mudança de dado/API, só reposicionamento dos campos já existentes (Status+Responsáveis / Datas+Prioridade / Tempo / Tags / Descrição).

## Fluxo de dados

1. `TasksPageClient` busca `/api/tasks/[client]` (mudança: resposta agora inclui `statuses`) e passa `tasks`+`statuses` pra `TasksTable`.
2. `TasksTable` monta uma seção por status (ordenado por `orderindex`), populando com as tasks correspondentes (ou vazia).
3. Clicar numa linha (`TaskRow`) abre o `TaskDetailModal`, sem mudança de comportamento.

## Tratamento de erros

Sem mudança em relação ao que já existe — `/api/tasks/[client]` continua com o mesmo padrão de erro (`no_list_configured`, `fetch_failed`), só o corpo de sucesso ganha um campo a mais.

## Testes / verificação

Sem suíte automatizada (padrão já estabelecido). Verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual: página Tasks da Débora (confirma que aparecem as 3 seções mesmo com "não iniciado"/"em andamento" vazias hoje, ícones corretos por tipo, colunas na ordem certa, bandeira de prioridade quando existir); abrir uma task e confirmar a nova ordem dos campos no modal.

## Fora de escopo (explícito, adiado pra próximos rounds)

- Checklist funcional no modal de Tasks.
- Anexos funcionais (upload de arquivo — ClickUp não aceita link como anexo, diferente do Trello).
- Campos customizados ("Add fields").
- Subtasks ("Add subtask").
- Vínculos entre tasks ("Relate items").
- Edição de status direto na linha da tabela (só dentro do modal, como hoje).
- Track time / cronômetro funcional.
