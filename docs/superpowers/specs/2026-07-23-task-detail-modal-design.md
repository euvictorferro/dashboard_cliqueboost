# Spec: Modal de detalhes da Task

Branch: `feature-tasks-clickup`. Extensão da página Tasks já construída (não mesclar em main/staging sem aprovação explícita do Victor).

## Contexto

A página Tasks hoje mostra uma lista enxuta (nome, data prevista, responsável, descrição). O Victor quer que clicar numa task abra um popup com mais detalhes — o objetivo de longo prazo é ir reduzindo a necessidade de abrir o ClickUp em si pra ver informação de uma task.

Investigação técnica feita antes do brainstorming: a chamada que a página já usa (`GET /list/{listId}/task`) devolve, por task, os mesmos campos ricos do endpoint de task individual — `priority`, `tags`, `start_date`, `time_estimate`, `time_spent`, e `assignees` completos (com `profilePicture`, `initials`, `color` reais do ClickUp). Não existe endpoint público documentado de "activity log" (histórico de mudanças) na API v2 do ClickUp — isso só existe na UI própria deles.

## Decisões (via brainstorming com o Victor)

1. **Activity log**: fora de escopo — não é possível replicar via API pública. O modal não mostra histórico de mudanças e não tem link nenhum de volta pro ClickUp (decisão explícita: sem link).
2. **Estilo do popup**: modal central (fundo escurecido atrás), não painel lateral.
3. **Fonte de dados**: nenhuma chamada nova — o modal usa exatamente a mesma task já carregada pela lista. Sem loading state, sem novo estado de erro.
4. **Somente leitura**: mesma regra já em vigor pra página Tasks inteira — este modal não edita nada.

## Arquitetura

- **`src/lib/clickup.ts`**: `TaskItem` ganha os campos:
  - `priority: { label: string; color: string } | null` — **atenção**: nenhuma task nos 6 clientes reais tem prioridade definida hoje, então não deu pra confirmar ao vivo o nome exato do sub-campo textual (a doc pública do ClickUp só diz que o valor numérico 1-4 mapeia pra Urgent/High/Normal/Low, sem detalhar o formato do objeto). Implementação precisa inspecionar a resposta bruta (`console.log` ou teste direto) assim que achar uma task com prioridade, e mapear com uma leitura defensiva que não quebre se o campo vier diferente do esperado — cair pra `null` em caso de formato inesperado, nunca lançar erro.
  - `tags: string[]`
  - `startDate: number | null` (epoch ms, mesmo formato de `dueDate`)
  - `timeEstimate: number | null` (ms)
  - `timeSpent: number` (ms, default `0` quando ausente)
  - `assignees: { name: string; color: string; initials: string; avatarUrl?: string }[]` (troca o formato atual de `string[]` — usa `username`, `color`, `initials`, `profilePicture` que a própria API já devolve, em vez de gerar cor/iniciais por hash no front)
- `fetchClientTasks` (mesma função, mesma chamada HTTP) só ganha mapeamento a mais pra esses campos. Nenhuma rota nova, nenhum novo parâmetro.

## Componentes

- **`TaskDetailModal.tsx`** (novo componente, `"use client"`): recebe `{ task: TaskItem; onClose: () => void }`. Modal centralizado, fundo escurecido (`bg-black/50` ou equivalente do tema), fecha ao clicar no X, clicar fora do modal, ou pressionar Esc. Conteúdo, nesta ordem:
  - Nome da task (título do modal)
  - Badge de status (cor real do ClickUp, igual já usado na seção da tabela)
  - Responsáveis: foto de perfil (ou iniciais coloridas quando não houver foto) + nome, um por linha ou lado a lado; "Sem responsável" quando vazio
  - Datas: "Início → Prazo" formatado em pt-BR quando os dois existirem; formatos parciais quando só um existir; "Sem prazo definido" quando nenhum existir
  - Prioridade: badge com a cor que o ClickUp atribui; "Sem prioridade" quando `null`
  - Tempo: estimativa e tempo gasto formatados em horas (ex: "2h estimadas", "45min registrados"); "Não definido" quando ambos ausentes
  - Tags: pills; "Sem tags" quando vazio
  - Descrição: texto corrido; "Sem descrição" quando vazio
- **`TasksTable.tsx`**: cada linha de task vira um elemento clicável (`<button>` ou `<div role="button">` com `onClick`). Estado local `selectedTask: TaskItem | null` controla a abertura do `TaskDetailModal`. Os avatares já existentes na tabela (hoje usam cor por hash + iniciais calculadas no front) passam a usar `task.assignees[].avatarUrl`/`color`/`initials` diretamente — mesma melhoria de fidelidade aproveitada nos dois lugares.

## Fluxo de dados

1. `TasksPageClient` já busca e guarda todas as tasks (inalterado).
2. `TasksTable` recebe essas tasks (inalterado) — só passa a guardar qual foi clicada.
3. Clicar numa linha seta `selectedTask` pra aquela task (já em memória) → `TaskDetailModal` renderiza na hora, sem esperar rede.
4. Fechar o modal (X, clique fora, ou Esc) volta `selectedTask` pra `null`.

## Tratamento de erros

- Nenhum novo — o modal só formata dados que já passaram pela validação do fetch original da página. Se um campo individual vier `null`/vazio, mostra o texto de estado vazio correspondente (ver lista de componentes acima), nunca quebra a renderização.

## Testes / verificação

- Sem suíte automatizada (padrão já estabelecido) — `npx tsc --noEmit`, `npm run build`, e checagem visual no Browser pane: clicar em tasks reais da Laís cobrindo pelo menos uma combinação com prioridade/tags/tempo preenchidos e uma totalmente vazia, confirmar todos os estados vazios corretos, e confirmar que Esc/clique fora/X fecham o modal.

## Fora de escopo (explícito)

- Feed de atividade/histórico de mudanças.
- Qualquer link de volta pro ClickUp.
- Edição de qualquer campo (status, prioridade, datas, tags, descrição) — tudo somente leitura.
- Comentários da task.
