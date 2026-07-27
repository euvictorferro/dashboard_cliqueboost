# Calendário: Mês / Semana / Dia (substitui Timeline) — Design

## Contexto

A página Calendário ganhou recentemente uma visualização "Timeline" (linha do tempo horizontal). O Victor decidiu que não é o formato certo e pediu pra trocar por um toggle de 3 visualizações mais tradicionais: **Mês / Semana / Dia** — mantendo Mês como já está, e adicionando Semana e Dia do zero.

Também foi levantado (e investigado antes deste desenho) um pedido de "garantir que eventos de outros dias apareçam, não só de 1 semana". Investigação confirmou que **não é bug de código**: o calendário já mostra todo card com `dueDate` presente. No board real da Débora, só a lista "Semana 3" tem cards com data preenchida no Trello (5 cards); "Semana 4" tem 5 cards sem data; "Semana 1"/"Semana 2" estão vazias (limpeza feita em 14/07/2026). Preencher as datas no Trello é ação do Victor, fora do escopo deste desenho.

Por fim, o Victor pediu que todo o cálculo de "qual dia é esse card" e a exibição de horário considerem **apenas o fuso America/New_York**, não o fuso do navegador de quem acessa. Isso vale pras três visualizações (Mês incluso, já que hoje ele bucketiza pelo fuso local do navegador — inconsistência que esta mudança também resolve).

## Decisões confirmadas com o Victor

- Remover completamente a visualização Timeline (arquivo e lógica).
- Toggle de 3 opções: Mês (padrão) / Semana / Dia.
- Semana: grade de 7 colunas igual ao Mês, só que 1 semana por vez, células mais altas.
- Dia: lista vertical dos cards do dia, ordenados por horário de postagem, com o horário exibido.
- Todo bucketing de data (qual dia um card pertence) e toda exibição de horário usam o fuso `America/New_York`, via `Intl.DateTimeFormat` (nativo do JS, sem biblioteca nova).

## Arquitetura

**Novo utilitário compartilhado: `src/lib/nyTime.ts`**
- `getNYDateParts(ms: number): { year, month, day, hour, minute }` — extrai os componentes de uma data/hora no fuso de NY a partir de um timestamp UTC (ms), via `Intl.DateTimeFormat` com `timeZone: "America/New_York"`. Lida com DST automaticamente (é o motivo de não fazer isso na mão com offset fixo).
- `isSameNYDay(ms: number, cell: { year, month, day }): boolean` — compara se um timestamp cai no mesmo dia-calendário (em NY) que uma célula de grade.
- `formatNYTime(ms: number): string` — formata a hora de um timestamp em `"HH:mm"` (24h), no fuso de NY.

**`src/components/CalendarMonthView.tsx` (existente)** — pequena alteração: troca `isSameDay(day, new Date(dueDate))` (comparação em fuso local do navegador) por `isSameNYDay(dueDate, {year: day.getFullYear(), month: day.getMonth(), day: day.getDate()})`. Os objetos `Date` da grade (`buildMonthGrid`) continuam sendo só identificadores de dia-calendário (construídos via `new Date(year, month, day)`), não representam um instante real — por isso extrair `getFullYear()/getMonth()/getDate()` deles continua seguro independente de fuso. O "hoje" destacado na grade passa a vir de `getNYDateParts(Date.now())` em vez de `new Date()` local.

**`src/components/CalendarWeekView.tsx` (novo)** — mesma lógica de grade do Mês, mas:
- Estado `currentWeekStart: Date` (domingo da semana atual), inicia na semana que contém "hoje" (calculado via `getNYDateParts`).
- Gera só 7 células (não múltiplo de 42 como o mês), sem dias `null` de preenchimento.
- Botões "semana anterior" / "próxima semana".
- Células mais altas (`min-h-[180px]` em vez de `min-h-[110px]`) pra caber mais cards visíveis por dia.
- Mesma cor por formato (`contentFormat.ts`) e mesmo clique abrindo `ContentCardModal` via `onSelectCard` callback, igual ao Mês.

**`src/components/CalendarDayView.tsx` (novo)**:
- Estado `currentDay: Date`, inicia em "hoje" (via `getNYDateParts`).
- Botões "dia anterior" / "próximo dia".
- Filtra os cards do dia selecionado (via `isSameNYDay`), ordena por `dueDate` crescente (= ordem cronológica de horário).
- Lista vertical: cada linha mostra horário (`formatNYTime`, ex: "17:00"), nome do card, e a mesma cor de fundo por formato usada nas outras visualizações. Clique abre o modal.
- Estado vazio: "Nenhum conteúdo agendado pra esse dia." quando não há cards.

**`src/components/CalendarView.tsx` (reescrito)** — container fino:
- `viewMode: "month" | "week" | "day"`, default `"month"`.
- Toggle com 3 botões (Mês / Semana / Dia) no topo, mesmo estilo visual do toggle Mês/Timeline atual.
- Continua segurando `selectedCard` + `ContentCardModal`, compartilhado entre as três visualizações.
- Renderiza `CalendarMonthView` / `CalendarWeekView` / `CalendarDayView` conforme o modo.

**Removido:**
- `src/components/CalendarTimelineView.tsx` (arquivo inteiro).
- Toda referência a `"timeline"` no `viewMode` e no toggle.

## Comportamento entre visualizações

- Cada visualização (Mês/Semana/Dia) é dona da própria navegação (mês atual / semana atual / dia atual) — ao trocar de visualização, a posição não é preservada (mesmo comportamento já aceito no Mês hoje: trocar de view reseta a posição de navegação). Não é objetivo deste desenho mudar isso.
- "Hoje" em todas as visualizações é calculado a partir do fuso de NY, não do fuso do navegador de quem acessa — importante pra não haver divergência entre o que o Victor vê e o que um cliente em outro fuso vê.

## Fora de escopo

- Preencher os `dueDate` faltando no Trello (ação do Victor, fora do código).
- Qualquer mudança na visualização de Mês além da correção de fuso horário.
- Grade por hora no Dia (avaliado e descartado — volume real de conteúdo por dia é baixo, lista simples é suficiente).

## Testes / verificação

- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual manual no navegador.
- Verificar especificamente: um card com `dueDate` perto da meia-noite UTC continua no mesmo dia em Mês, Semana e Dia (não muda de dia entre visualizações); horário exibido no Dia bate com o fuso de NY (conferir contra o valor UTC bruto do card).
