# Spec: Comentários e atividades + ícones no modal de Tasks

Branch: `feature-conteudos-refinamento` (mesma branch em uso, ainda não mesclada). Repo `/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost`.

## Contexto

O Victor pediu pra replicar no modal de Tasks o mesmo padrão que o painel de "Comentários e atividade" já tem no modal de Conteúdos (Trello): por padrão só mostra a criação do item, um botão revela o resto (no caso do Trello, ações do board; no caso do ClickUp, os comentários reais). Também pediu ícones nos rótulos dos campos, iguais aos já usados no modal de Conteúdos.

Investigação feita antes do design, usando o token real do app contra a task real da Débora (`86e24ghq2`):

- `date_created` (epoch ms, string) e `creator: {id, username, color, email, profilePicture}` já vêm na mesma chamada que `fetchClientTasks` já faz (`GET /list/{id}/task`) — confirmado ao vivo, sem chamada nova.
- O ClickUp **não tem** um feed de atividades tipo o do Trello (mudança de status, membro adicionado, etc.) disponível na API pública v2 — só existe o timestamp de criação (mais `date_updated`/`date_closed`/`date_done`, não usados aqui) e os comentários reais (já buscados hoje via `/task/{id}/comment`).

## Decisões (via brainstorming com o Victor)

1. **"Atividade" no ClickUp = criação da task + comentários reais** — não existe um log de mudanças de status/campo pra mostrar, diferente do Trello. A "criação" vira uma entrada sintética (não vem de uma API de atividade, é montada a partir de `dateCreated`/`creator`).
2. **Painel renomeado**: "Comentários" vira "Comentários e atividades", com o ícone `CommentsIcon` (o mesmo já usado em Conteúdos) ao lado do título.
3. **Visão padrão (recolhida)**: mostra só "[Nome do criador] criou essa task" + data relativa — mesmo padrão do `ActivityField` de Conteúdos, que por padrão só mostra a criação.
4. **Botão "Mostrar atividades"**: revela os comentários reais (que hoje aparecem sempre) — texto exato do botão como pedido pelo Victor ("Mostrar atividades" / ao clicar de novo, "Fechar atividades").
5. **Ícone na Descrição**: `DescriptionIcon` (mesmo já usado em Conteúdos) ao lado do rótulo "Descrição".
6. **Sem mudança nos outros campos** (Status/Responsáveis/Data prevista/Prioridade/Tags/Tempo) — no modal de Conteúdos, só Descrição e Anexos/Checklist/Atividade têm ícone; Labels/Membros/Data prevista não têm. Tasks não tem anexos/checklist, então só Descrição e o painel de atividades ganham ícone, espelhando exatamente o que Conteúdos já faz.

## Arquitetura

- **`src/lib/clickup.ts`**: `TaskItem` ganha `dateCreated: number` e `creator: { name: string; color: string; initials: string; avatarUrl?: string }`, populados de `t.date_created`/`t.creator` (já vêm na resposta existente, sem chamada nova). `initials` calculado a partir do `username` (primeira letra, mesmo padrão simples já usado nos outros lugares — ClickUp não devolve iniciais prontas pro `creator`, diferente do campo `assignees`, que já vem com `initials`).
- **`TaskDetailModal.tsx`**:
  - `DescriptionField` ganha `icon={<DescriptionIcon size={14} />}`.
  - `CommentsField` renomeado o título pra "Comentários e atividades" com `<CommentsIcon size={14} />` ao lado; ganha um botão "Mostrar atividades"/"Fechar atividades" (só aparece quando há pelo menos 1 comentário real, mesmo padrão condicional do botão "Mostrar Detalhes" de Conteúdos); por padrão mostra só a entrada sintética de criação (`task.creator`/`task.dateCreated`); expandido mostra a criação + todos os comentários reais (já buscados pela rota existente, sem mudança na busca).

## Fluxo de dados

Sem mudança de rotas — `dateCreated`/`creator` já chegam na resposta de `/api/tasks/[client]` (que já devolve `TaskItem[]` completo) e nos comentários já buscados por `/api/tasks/[client]/task/[taskId]/comments`. Tudo client-side: o `CommentsField` decide o que mostrar com base no estado local `showActivity`.

## Tratamento de erros

Sem mudança — mesmo comportamento de erro já existente na busca de comentários (`"Não foi possível carregar."`).

## Testes / verificação

Sem suíte automatizada (padrão já estabelecido). Verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual: abrir uma task da Débora, confirmar que o painel mostra "Comentários e atividades" com ícone, a entrada de criação aparece por padrão (nome do criador + data relativa), o botão "Mostrar atividades" revela os comentários reais, e a Descrição mostra o ícone ao lado do rótulo.

## Fora de escopo (explícito)

- Qualquer tentativa de reconstruir um log de mudanças de status/campo — a API do ClickUp não expõe isso.
- Ícones em Status/Responsáveis/Data prevista/Prioridade/Tags (Conteúdos também não tem ícone nesses campos equivalentes).
- Mudança na busca/paginação de comentários — continua exatamente como já funciona hoje.
