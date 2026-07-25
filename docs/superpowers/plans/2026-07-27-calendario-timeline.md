# Visualização Timeline no Calendário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A página Calendário ganha um toggle "Mês"/"Timeline" — Timeline é uma linha do tempo horizontal (uma coluna por dia, do primeiro ao último card com data real, scroll horizontal, botão "Hoje") como alternativa à grade mensal já existente.

**Architecture:** `CalendarView.tsx` (hoje um componente monolítico com a grade mensal) é dividido em 3 arquivos: `contentFormat.ts` (lógica de cor por formato, compartilhada), `CalendarMonthView.tsx` (a grade mensal extraída, sem mudança de comportamento) e `CalendarTimelineView.tsx` (novo). `CalendarView.tsx` vira um container fino que alterna entre os dois e segura o estado do modal, compartilhado pelas duas visualizações.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 — sem dependências novas.

## Global Constraints

- Sem lib de calendário externa — Timeline é construída na mão, mesmo espírito da grade mensal já existente.
- Timeline cobre exatamente o intervalo real dos dados (do primeiro ao último card com `dueDate`) — sem paginação, sem calendário infinito.
- Cor por formato (roxo pra Reels/TikTok, azul pra Carrossel/Post Único/Artigo/LinkedIn/Blog, neutro caso contrário) é a mesma lógica já commitada — só muda de lugar (`contentFormat.ts`), a lógica em si não muda.
- Clicar num card em qualquer visualização abre o mesmo `ContentCardModal` já existente (`src/components/ContentCardModal.tsx`) — sem modificar esse arquivo.
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual no Browser pane.
- Não mesclar em `main`/`staging` sem aprovação explícita do Victor.

---

### Task 1: Extrair `contentFormat.ts` + `CalendarMonthView.tsx` (refactor puro, sem mudança de comportamento)

**Files:**
- Create: `src/lib/contentFormat.ts`
- Create: `src/components/CalendarMonthView.tsx`
- Modify: `src/components/CalendarView.tsx` (arquivo inteiro será substituído)

**Interfaces:**
- Produces: `ContentFormat` (type), `getContentFormat(card)`, `FORMAT_BAR_CLASSES` — exportados de `contentFormat.ts`, consumidos por `CalendarMonthView.tsx` (esta task) e `CalendarTimelineView.tsx` (Task 2). `CalendarMonthView({ cards, onSelectCard }: { cards: ContentCard[]; onSelectCard: (card: ContentCard) => void })` — consumido por `CalendarView.tsx` (esta task) e continua sendo consumido na Task 2.

Este é um refactor puro — o comportamento visual da grade mensal deve ficar idêntico ao de antes desta task. Nenhuma lógica muda, só a organização dos arquivos.

- [ ] **Step 1: Criar `src/lib/contentFormat.ts`**

```ts
// src/lib/contentFormat.ts
import type { ContentCard as ContentCardData } from "./trello";

// ponytail: classificação por label do Trello, não pelo nome do card — se o cliente não usa
// nenhuma dessas labels ainda (alguns boards só têm labels de status), o card cai no "default".
export type ContentFormat = "video" | "text" | null;

export function getContentFormat(card: ContentCardData): ContentFormat {
  if (card.labels.some((l) => /reels?|tiktok/i.test(l.name))) return "video";
  if (card.labels.some((l) => /carrossel|post ú?nico|artigo|linkedin|blog/i.test(l.name))) return "text";
  return null;
}

export const FORMAT_BAR_CLASSES: Record<"video" | "text" | "default", string> = {
  video: "bg-purple-500/15 text-purple-600 hover:bg-purple-500/25",
  text: "bg-blue-500/15 text-blue-600 hover:bg-blue-500/25",
  default: "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20",
};
```

- [ ] **Step 2: Criar `src/components/CalendarMonthView.tsx`**

```tsx
// src/components/CalendarMonthView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ponytail: grade sempre múltipla de 7 (preenche com null antes do dia 1 e depois do último
// dia, pra alinhar as colunas de domingo a sábado) — sem lib de calendário, é só aritmética de data.
function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function CalendarMonthView({
  cards,
  onSelectCard,
}: {
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const cells = buildMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth());

  function cardsForDay(day: Date): ContentCardData[] {
    return datedCards.filter((c) => isSameDay(new Date(c.dueDate!), day));
  }

  function goToPrevMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-card-foreground">
          {MONTH_LABELS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevMonth}
            aria-label="Mês anterior"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            aria-label="Próximo mês"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-muted px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className="min-h-[110px] bg-card p-1.5">
            {day && (
              <>
                <p className={`mb-1 text-xs font-medium ${isSameDay(day, today) ? "text-brand-primary" : "text-muted-foreground"}`}>
                  {day.getDate()}
                </p>
                <div className="space-y-1">
                  {cardsForDay(day).map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onSelectCard(card)}
                      className={`block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium transition-colors ${FORMAT_BAR_CLASSES[getContentFormat(card) ?? "default"]}`}
                    >
                      {card.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Reescrever `src/components/CalendarView.tsx`**

```tsx
// src/components/CalendarView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { ContentCardModal } from "./ContentCardModal";
import { CalendarMonthView } from "./CalendarMonthView";

export function CalendarView({
  cards,
  clientId,
  accessKey,
}: {
  cards: ContentCardData[];
  clientId: string;
  accessKey: string;
}) {
  const [selectedCard, setSelectedCard] = useState<ContentCardData | null>(null);

  return (
    <div>
      <CalendarMonthView cards={cards} onSelectCard={setSelectedCard} />

      {selectedCard && (
        <ContentCardModal card={selectedCard} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build limpo, `/[client]/calendario` continua na lista de rotas.

- [ ] **Step 6: Checagem visual — regressão pura**

Abrir `/tiago/calendario?key=b9d179192160c98b579807d25f8a956e` (15 de 23 cards com data real, bom teste de volume). Confirmar que a grade mensal se comporta EXATAMENTE como antes: navegação mês anterior/próximo funciona, cards aparecem nos dias certos com a cor por formato (a maioria neutra, já que Tiago não usa labels de formato — isso é esperado e não mudou), clicar num card abre o `ContentCardModal` com os dados certos, fechar funciona. Esse é um teste de regressão — se algo mudou visualmente, é bug desta task.

- [ ] **Step 7: Commit**

```bash
git add src/lib/contentFormat.ts src/components/CalendarMonthView.tsx src/components/CalendarView.tsx
git commit -m "Extrai contentFormat.ts + CalendarMonthView.tsx (refactor puro, sem mudança de comportamento)"
```

---

### Task 2: `CalendarTimelineView.tsx` + toggle Mês/Timeline

**Files:**
- Create: `src/components/CalendarTimelineView.tsx`
- Modify: `src/components/CalendarView.tsx` (arquivo inteiro será substituído)

**Interfaces:**
- Consumes: `getContentFormat`/`FORMAT_BAR_CLASSES` de `src/lib/contentFormat.ts` (Task 1), `CalendarMonthView` (Task 1, sem mudança de assinatura).
- Produces: `CalendarTimelineView({ cards, onSelectCard }: { cards: ContentCard[]; onSelectCard: (card: ContentCard) => void })` — mesma assinatura de `CalendarMonthView`, usada por `CalendarView.tsx`.

- [ ] **Step 1: Criar `src/components/CalendarTimelineView.tsx`**

```tsx
// src/components/CalendarTimelineView.tsx
"use client";

import { useEffect, useRef } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isWeekend(day: Date): boolean {
  const weekday = day.getDay();
  return weekday === 0 || weekday === 6;
}

// ponytail: gera um array de dias contínuo do primeiro ao último dia com card real — sem
// paginação, cobre exatamente o intervalo dos dados de verdade (nunca um calendário infinito).
function buildDayRange(datedCards: ContentCardData[]): Date[] {
  if (datedCards.length === 0) return [];
  const timestamps = datedCards.map((c) => c.dueDate!);
  const min = new Date(Math.min(...timestamps));
  const max = new Date(Math.max(...timestamps));
  const start = new Date(min.getFullYear(), min.getMonth(), min.getDate());
  const end = new Date(max.getFullYear(), max.getMonth(), max.getDate());

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function CalendarTimelineView({
  cards,
  onSelectCard,
}: {
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const today = new Date();
  const todayRef = useRef<HTMLDivElement>(null);

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const days = buildDayRange(datedCards);

  function cardsForDay(day: Date): ContentCardData[] {
    return datedCards.filter((c) => isSameDay(new Date(c.dueDate!), day));
  }

  function scrollToToday() {
    todayRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  useEffect(() => {
    scrollToToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem, pra abrir já centralizado em hoje
  }, []);

  if (days.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhum card com data prevista encontrado.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-card-foreground">
          {days[0].getDate()} {MONTH_SHORT[days[0].getMonth()]} {days[0].getFullYear()} — {days[days.length - 1].getDate()}{" "}
          {MONTH_SHORT[days[days.length - 1].getMonth()]} {days[days.length - 1].getFullYear()}
        </h2>
        <button
          type="button"
          onClick={scrollToToday}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
        >
          Hoje
        </button>
      </div>

      <div className="flex gap-px overflow-x-auto rounded-[var(--radius-card)] border border-border bg-border pb-1">
        {days.map((day, i) => {
          const dayIsToday = isSameDay(day, today);
          return (
            <div
              key={i}
              ref={dayIsToday ? todayRef : undefined}
              className={`min-h-[140px] w-32 shrink-0 p-1.5 ${isWeekend(day) ? "bg-muted/60" : "bg-card"}`}
            >
              <p className={`mb-1 text-xs font-medium ${dayIsToday ? "text-brand-primary" : "text-muted-foreground"}`}>
                {WEEKDAY_LABELS[day.getDay()]} {day.getDate()}/{day.getMonth() + 1}
              </p>
              <div className="space-y-1">
                {cardsForDay(day).map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onSelectCard(card)}
                    className={`block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium transition-colors ${FORMAT_BAR_CLASSES[getContentFormat(card) ?? "default"]}`}
                  >
                    {card.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reescrever `src/components/CalendarView.tsx`**

```tsx
// src/components/CalendarView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { ContentCardModal } from "./ContentCardModal";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarTimelineView } from "./CalendarTimelineView";

type ViewMode = "month" | "timeline";

export function CalendarView({
  cards,
  clientId,
  accessKey,
}: {
  cards: ContentCardData[];
  clientId: string;
  accessKey: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedCard, setSelectedCard] = useState<ContentCardData | null>(null);

  return (
    <div>
      <div className="mb-4 flex w-fit gap-1 rounded-md border border-border p-1">
        <button
          type="button"
          onClick={() => setViewMode("month")}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
            viewMode === "month" ? "bg-brand-primary/10 text-brand-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Mês
        </button>
        <button
          type="button"
          onClick={() => setViewMode("timeline")}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
            viewMode === "timeline" ? "bg-brand-primary/10 text-brand-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Timeline
        </button>
      </div>

      {viewMode === "month" ? (
        <CalendarMonthView cards={cards} onSelectCard={setSelectedCard} />
      ) : (
        <CalendarTimelineView cards={cards} onSelectCard={setSelectedCard} />
      )}

      {selectedCard && (
        <ContentCardModal card={selectedCard} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 5: Checagem visual completa**

Abrir `/tiago/calendario?key=b9d179192160c98b579807d25f8a956e` (15 cards com data, bom teste de volume/espalhamento). Confirmar:
- Toggle "Mês"/"Timeline" aparece no topo, "Mês" ativo por padrão.
- Clicar "Timeline": confirma que aparece uma faixa horizontal de colunas por dia, cobrindo do primeiro ao último dia com card real (não o mês inteiro, só o intervalo real dos dados). Fins de semana com fundo levemente diferente. Rolar horizontalmente funciona (mouse/trackpad).
- Clicar "Hoje": confirma que rola até a coluna do dia atual (pode estar fora do intervalo de dados de Tiago — nesse caso a coluna de hoje não existe e o botão não deve quebrar nada, só não ter efeito visível já que não há `ref` pra rolar até).
- Clicar num card na Timeline: confirma que abre o `ContentCardModal` com os dados certos. Fechar funciona.
- Clicar "Mês" de novo: confirma que volta pra grade mensal, comportamento intacto.
- Testar também com um board sem nenhum card com data (verificar se algum cliente está nessa situação, ou simular removendo temporariamente — não é obrigatório se nenhum cliente real estiver assim) — a Timeline deve mostrar "Nenhum card com data prevista encontrado." em vez de quebrar.
- Checar `read_console_messages` sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/CalendarTimelineView.tsx src/components/CalendarView.tsx
git commit -m "Adiciona visualização Timeline ao Calendário (toggle Mês/Timeline)"
```
