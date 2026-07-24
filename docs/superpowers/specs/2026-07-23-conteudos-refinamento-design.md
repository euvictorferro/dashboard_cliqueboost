# Spec: Refinamento da página Conteúdos (pop-up de card + visual estilo Trello)

Branch: `feature-conteudos-refinamento` (criada a partir da ponta de `feature-conteudos-trello`, ainda não mesclada). Segue diretamente o feedback do Victor após revisar o preview da feature Conteúdos.

## Contexto

O Victor revisou o preview da página Conteúdos (Kanban do Trello) e pediu dois ajustes:

1. **Bug**: a sidebar sumia ao rolar o board horizontalmente. **Já corrigido** na branch `feature-conteudos-trello` (commit `bc60d86`) — causa raiz era o wrapper flex do conteúdo não ter `min-w-0`, o que deixava a página inteira esticar e rolar horizontalmente junto com o board, arrastando a sidebar. Fora de escopo deste documento.
2. **Pedido de produto**: clicar num card deve abrir um pop-up com mais detalhes (como no Trello), e o board (fora do pop-up) deve ficar visualmente mais parecido com um board real do Trello — exceto fundo colorido e botão de adicionar card, que ficam de fora.

Investigação feita antes do design: testei ao vivo os 6 boards reais dos clientes (`badges.checkItems`, `badges.comments`, `idMembers`, `badges.due`) via API do Trello:

| Cliente | Cards | Checklist | Comentários | Data (due) | Responsável |
|---|---|---|---|---|---|
| Débora | 47 | 0 | 0 | 0 | 0 |
| Laís | 49 | 0 | 0 | 0 | 0 |
| Sam | 13 | 0 | 0 | 0 | 0 |
| Nelson | 0 | 0 | 0 | 0 | 0 |
| Tiago | 23 | 0 | 0 | 15 | 0 |
| Bela | 43 | 0 | 0 | 31 | 0 |

Checklists e comentários têm 0% de uso em todos os boards — não valem uma chamada nova de API. Datas de entrega são usadas de verdade em 2 dos 6 boards (Bela, Tiago) — correção em relação à spec anterior, que só tinha testado o board da Débora e generalizou "due vazio" para todos.

## Decisões (via brainstorming com o Victor)

1. **Branch**: nova branch (`feature-conteudos-refinamento`), a partir da ponta de `feature-conteudos-trello` — não mescla ainda, mesma disciplina de aprovação explícita antes de ir pra `main`/`staging`.
2. **Fonte de dados do pop-up**: nenhuma chamada nova ao Trello. O pop-up usa exatamente os campos já carregados em `ContentCard`/`ContentList` (nome, descrição, labels, data, responsável, anexos) — mesmo padrão já aprovado no `TaskDetailModal.tsx` da página Tasks.
3. **Escopo do redesign visual**: o board inteiro (colunas e cards), não só o pop-up, fica mais parecido com o Trello — mantendo a paleta de cores do dashboard Clique Boost (não copia o cinza/preto do Trello).
4. **Metadados vazios no card do board**: escondidos (estilo Trello — só mostra data/responsável quando o Trello realmente tem o dado). No pop-up, "Sem prazo"/"Sem responsável" continuam aparecendo explicitamente.

## Componentes

- **`ContentCardModal.tsx`** (novo, `"use client"`): abre ao clicar num `ContentCard`, fecha com X, Esc ou clique fora — mesmo padrão de `TaskDetailModal.tsx`. Mostra, sem truncar:
  - Título do card
  - Labels (pills coloridos, cor exata do Trello)
  - Descrição completa
  - Data prevista ("Sem prazo" quando vazio)
  - Responsável ("Sem responsável" quando vazio)
  - Anexos (lista de links, abrem em nova aba)
  - **Fora de escopo**: botões de ação (Add/Dates/Checklist/Members/Attachment do Trello) — são edição, e a página é só-leitura. Painel "Comments and activity" — 0% de uso real.

- **`ContentCard.tsx`** (modificado): vira clicável (`onClick` abre o modal, `cursor-pointer`, leve destaque no hover — sinaliza interatividade). Fica mais compacto (padding menor, mais perto da densidade real de um card do Trello). Data e responsável só aparecem quando o Trello tem o dado (`card.dueDate !== null` / `card.assignees.length > 0`) — quando vazios, a linha inteira some (sem "Sem prazo"/"Sem responsável" no board).

- **`ContentBoard.tsx`** (modificado): cabeçalho de coluna mais definido (nome em negrito + contagem, fundo mais sólido, cantos arredondados no topo da coluna) — sem virar pill colorido (listas do Trello não têm cor própria, diferente dos status do ClickUp usados em Tasks).

## Fluxo de dados

Sem mudança — `ContentPageClient` continua buscando `/api/content/[client]` uma vez ao carregar. O clique num card só abre um modal com o `ContentCard` já em memória (estado local `selectedCard`, mesmo padrão de `selectedTask` em `TasksTable.tsx`).

## Tratamento de erros

Sem mudança em relação à spec anterior (`2026-07-23-conteudos-trello-design.md`) — nenhum caminho de erro novo introduzido.

## Testes / verificação

Sem suíte automatizada (padrão já estabelecido). Verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual no Browser pane: abrir um card com data preenchida (board da Bela ou do Tiago) e um sem (board da Débora), confirmar que o modal mostra "Sem prazo" corretamente no segundo caso e a linha some do card do board; confirmar clique fora/Esc/X fecham o modal.

## Fora de escopo (explícito)

- Qualquer escrita no Trello (criar/editar/mover card, checklist, comentário) — mantém a decisão já tomada na spec anterior.
- Buscar checklists ou comentários via API — 0% de uso real, confirmado ao vivo nos 6 boards.
- Fundo colorido do board e botão de "adicionar card" — excluídos explicitamente pelo Victor.
- Mudar a paleta de cores do dashboard para a paleta do Trello — mantemos a identidade visual já estabelecida (roxo/azul Clique Boost), só a estrutura/densidade do layout se aproxima do Trello.
