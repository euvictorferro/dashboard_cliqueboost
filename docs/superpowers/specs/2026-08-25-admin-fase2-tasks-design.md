# Admin Panel Fase 2 — Tasks nativo (mata o ClickUp) — Spec

**Data:** 2026-08-25 · **Status:** aprovado pelo Victor (brainstorm em sessão)

Continuação de `docs/superpowers/specs/2026-08-07-admin-panel-design.md` (Fase 1 já entregue: Clientes, Indicações, Faturamento). Esta spec detalha e ajusta a Fase 2 original com base no que foi decidido nesta sessão.

## Visão

Kanban de tasks nativo, gerenciado pelo admin (`admin.cliqueboost.io`) e visualizado/operado parcialmente pelo cliente em `/{client}/tasks`. Objetivo: paridade real com os recursos do ClickUp que a agência efetivamente usa hoje, não o mínimo da spec original — porque a intenção é abandonar o ClickUp de vez, não conviver com ele.

**Sem migração de dados do ClickUp.** As tasks hoje ativas no ClickUp não são usadas pelo cliente e não têm valor de continuidade — o kanban novo nasce vazio. O ClickUp deixa de ser fonte de dados no momento em que cada cliente migra; não existe script de importação nem período de leitura híbrida por task.

## Modelo de dados

Estende o que já estava previsto na spec de 07/08 (`tasks`, `task_comments`, `task_statuses`) com o necessário pra paridade ClickUp:

```
tasks                 id, agency_id, client_id, title, description, status_id,
                       priority (urgent|high|normal|low), assignee_admin_user_id,
                       due_at, position, created_by, created_at
task_statuses          id, agency_id, client_id?, name, color, position
                       -- colunas do kanban, customizáveis por cliente (já previsto)
task_comments          id, task_id, author_admin_user_id?, author_client_id?, body, created_at
                       -- author é admin OU cliente (um dos dois), nunca os dois
task_checklist_items   id, task_id, label, done boolean, position
task_attachments        id, task_id, storage_path, filename, uploaded_by_admin_user_id, created_at
                       -- mesmo bucket/padrão de storage já usado em conta/logo e bug-reports
task_tags              id, agency_id, name, color
task_tag_links         task_id, tag_id
```

Coluna nova em `clients`: `is_test boolean not null default false` — marca os 2 clientes de teste (não aparecem em relatórios/faturamento real, só existem pra QA).

## Permissões

- **Admin** (`admin.cliqueboost.io`): CRUD completo em tudo — cria/edita/apaga task, gerencia status/tags/checklist/anexos, comenta.
- **Cliente** (`/{client}/tasks`): pode **mudar o status** da task (drag-and-drop ou seletor) e **comentar**. Não cria, não edita título/descrição/prioridade/prazo/anexo, não apaga. Enforce na rota de API (`app/api/tasks/[client]/...`), não só escondendo botão na UI — mesmo princípio de `lib/access.ts` já usado no resto do app.

## Clientes de teste

2 linhas novas em `clients` com `is_test = true`, criadas pelo fluxo normal do admin (Fase 1, "criar cliente"). Usadas pra validar o fluxo ponta a ponta (admin cria task → cliente comenta/muda status → admin vê) sem tocar em conta de cliente real. Aparecem na lista do admin com indicação visual de "teste", ficam fora de faturamento/indicações.

## Virada (ClickUp → nativo)

Por cliente, não em bloco: quando o kanban nativo de um cliente estiver validado (via os clientes de teste primeiro, depois um cliente real como piloto), a página `/{client}/tasks` do dashboard passa a ler das tabelas novas em vez do `lib/clickup.ts`. Sem transição híbrida — cada cliente lê de uma fonte só, nunca as duas. Quando todos os clientes tiverem migrado, `lib/clickup.ts` e a coluna `clients.clickup_list_id` morrem.

## Fora do escopo desta fase

- Automações, recorrências, templates de task (igual à spec original)
- Importação de tasks existentes do ClickUp (decisão desta sessão — não há valor de continuidade)
- Subtarefas aninhadas em múltiplos níveis — checklist simples (item + done) cobre o uso real
- Roles/permissões granulares (fora da v1 do Admin Panel como um todo)

## Critério de sucesso

Um cliente de teste consegue: admin cria task com prioridade, tag e checklist → cliente vê, comenta e muda status → admin acompanha tudo isso no kanban dele. Depois disso validado, primeiro cliente real migra.
