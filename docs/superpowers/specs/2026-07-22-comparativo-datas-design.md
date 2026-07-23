# Spec: Comparativo de datas

Branch: `plataforma-v2`. **Não mesclar em `main`/`staging` até aprovação explícita do Victor** — feature em desenvolvimento, sem exposição a clientes.

## Contexto

Item L1 do roadmap da plataforma (`docs/superpowers/ROADMAP-plataforma.md`), vindo das notas do Victor no Obsidian: hoje o filtro de período na seção "Métricas" do dashboard só tem opções fixas (Hoje, 7/14/30/60/90 dias). A ideia é adicionar uma opção "Personalizado" que compara 2 janelas de data lado a lado nos gráficos (linha roxa vs. linha azul).

Aplica-se só à seção "Métricas" (cards, Alcance, Views, Curtidas). **Não** se aplica à seção "Público" (que já tem seu próprio filtro de timeframe, `AudienceTimeframeFilter`, e não faz parte deste escopo).

Não depende de nenhuma API paga — reaproveita a Meta Graph API já integrada (`src/lib/meta.ts`).

## Decisões (via brainstorming com o Victor)

1. **Entrada do UX**: "Personalizado" é mais um item dentro do dropdown `DateRangeFilter` existente (ao lado de Hoje/7 dias/etc). Ao selecionar, abre 2 seletores de data no lugar da lista.
2. **Cards numéricos**: em modo comparação, cada card mostra o valor do Período A e do Período B lado a lado (ex: "1.240 vs. 980") com a % de variação entre eles — substitui a comparação automática "vs. período anterior" que existe hoje (essa comparação automática continua normal fora do modo comparativo).
3. **Duração dos períodos**: sempre igual entre A e B, forçada pela UI. Período A é livre (2 datas, define a duração N). Período B só pede a data de início; a data de fim é calculada (início + N dias) e mostrada como texto não editável.
4. **Alinhamento dos gráficos**: por dia relativo ("Dia 1", "Dia 2", ...), não por data de calendário — como as durações são sempre iguais, os arrays de tendência de A e B sempre têm o mesmo tamanho.
5. **Top 5 posts / pizzas de origem-tipo de conteúdo**: continuam mostrando só o Período A em modo comparação. Não duplicam.
6. **Relatório em PDF**: botão fica desabilitado (com tooltip explicando) quando o modo comparativo está ativo. PDF não suporta comparação nesta versão.

## Arquitetura

- `DATE_RANGES` (`src/lib/metrics.ts`) ganha um item `{ id: "custom", label: "Personalizado" }`, sem `days` fixo (a duração vem das datas escolhidas, não de um preset).
- Novo estado em `Dashboard.tsx`: `compareWindows: { a: {since: string; until: string}; b: {since: string; until: string} } | null`. `null` = modo normal, comportamento 100% inalterado.
- `fetchOrganicSnapshotLive` (`src/lib/meta.ts`) é refatorada em 2 camadas:
  - Núcleo `fetchOrganicSnapshotForWindow(igId, since: number, until: number)` — faz o trabalho real (o que `fetchOrganicSnapshotLive` já faz hoje, exceto o cálculo de since/until a partir do preset).
  - `fetchOrganicSnapshotLive(igId, range: DateRangeId)` continua existindo, agora como wrapper fino: calcula since/until a partir do `DATE_RANGES` e delega pro núcleo. **Nenhuma mudança de comportamento no caminho existente.**
- Rota `/api/organic/[client]` (`src/app/api/organic/[client]/route.ts`) aceita `since`/`until` (ISO date, `YYYY-MM-DD`) como alternativa a `range` na query string. Se `since`/`until` vierem preenchidos, eles têm prioridade sobre `range`; caso contrário, comportamento atual inalterado.
- `getOrganicSnapshot` (mock, `src/lib/metrics.ts`) passa a aceitar `days: number` diretamente (em vez de só derivar de um `DateRangeId` fixo), pra cobrir o fallback de erro também no modo comparativo. A assinatura pública que recebe `DateRangeId` continua existindo como wrapper.

## Componentes

- **`DateRangeFilter`**: sem mudança estrutural, só ganha o item "Personalizado" na lista renderizada a partir de `DATE_RANGES`.
- **`CompareRangePicker`** (novo componente): renderizado dentro do painel do dropdown quando `range === "custom"`.
  - Período A: 2 `<input type="date">` (de/até), com validação `até > desde`.
  - Período B: 1 `<input type="date">` (início) + texto calculado do fim (início + N dias, N = duração de A).
  - Botão "Aplicar": desabilitado até A e B estarem válidos e preenchidos. Ao clicar, chama `onApply({a, b})` e fecha o painel.
- **`MetricCard`**: ganha prop opcional `compare?: { valueB: string; deltaPct: number | null; sparklineB?: {value: number}[] }`.
  - Quando presente: troca o badge "valor + % vs. período anterior" por "valor A vs. valor B + % de variação entre eles".
  - O sub-componente `Sparkline` interno ganha uma 2ª série opcional (`dataB`), desenhando 2 `<Line>` do Recharts: roxa (A, cor `hsl(var(--brand-primary))`) e azul (B, cor `hsl(var(--brand-accent))`, já usada hoje pro sparkline único).
- **`ReachBarChart`** (card "Alcance"): em modo comparação, troca a barra/trilho atual por 2 linhas sobrepostas (mesmo tratamento de cor do `MetricCard`). Fora do modo comparação, sem alteração.
- Cards sem sparkline hoje (Comentários, Salvamentos, Compartilhamentos, Seguidores novos/perdidos/líquidos): só trocam pra "valor A vs. valor B + %", sem gráfico — consistente com o formato atual desses cards.

## Fluxo de dados

1. Usuário seleciona "Personalizado" no `DateRangeFilter` → abre `CompareRangePicker`. Até clicar "Aplicar", o dashboard continua mostrando o que já estava carregado antes (último `range` ou `compareWindows` válido) — sem tela vazia/intermediária.
2. Preenche Período A (2 datas) e o início do Período B → fim de B é calculado automaticamente.
3. Clica "Aplicar" → `Dashboard` seta `compareWindows` → `useEffect` dispara 2 fetches em paralelo pra `/api/organic/[client]?since=...&until=...&key=...`, um por janela.
4. Cada fetch é independente e resiliente (mesmo padrão de fallback pra mock em caso de erro que já existe hoje — se uma janela falhar, cai pro mock só dela, sem travar a outra).
5. Com os 2 snapshots (`snapshotA`, `snapshotB`) em mãos, `Dashboard` passa as props de comparação pros cards e pro `ReachBarChart`. Alinhamento dos arrays de tendência é por índice (dia relativo), não por data de calendário.
6. Top 5 posts e `ReachBreakdownCard` (pizzas) usam só `snapshotA` — mesmo em modo comparação, a janela B ainda busca esses dados via a mesma função núcleo (não vale a pena criar um parâmetro só pra pular isso numa v1), mas ficam sem uso na tela. `// ponytail: busca de mais fica sem uso, otimiza se o volume de chamada à Graph API virar problema real.`
7. Se o usuário reabrir o dropdown e escolher qualquer preset normal (Hoje/7/14/30/60/90 dias), `compareWindows` volta pra `null` e o dashboard volta ao modo de período único, buscando pelo `range` escolhido — comportamento idêntico ao atual.

## Tratamento de erros

- Fallback pra mock por janela, independente (comportamento já existente, sem mudança de política).
- `CompareRangePicker` bloqueia o botão "Aplicar" até A ter `até > desde` e B ter uma data de início válida.
- Botão "Baixar relatório" fica desabilitado (com tooltip) sempre que `compareWindows !== null`.

## Testes / verificação

- Sem suíte de testes automatizada no projeto (padrão já estabelecido) — verificação manual via Browser pane:
  - Aplicar comparativo (ex: últimos 7 dias vs. os 7 dias anteriores) e confirmar cards com 2 valores + %, Alcance/Views/Curtidas com 2 linhas, Top 5 posts e pizzas mostrando só Período A, botão de PDF desabilitado.
  - Confirmar que o modo normal (dropdown com Hoje/7/14/30/60/90 dias) continua idêntico ao atual — nenhuma regressão.

## Fora de escopo (explícito)

- Seção "Público" (demografia) — não entra no comparativo.
- Exportação de PDF comparativo.
- Duração de períodos diferente entre A e B.
- Comparação de Top 5 posts ou das pizzas de origem/tipo de conteúdo.
