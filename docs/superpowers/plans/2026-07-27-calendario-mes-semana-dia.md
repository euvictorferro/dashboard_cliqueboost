# Calendário: Mês / Semana / Dia (substitui Timeline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a visualização "Timeline" do Calendário por um toggle de 3 visualizações — Mês / Semana / Dia — e corrigir o bucketing de dias e a exibição de horário pra usarem sempre o fuso `America/New_York`, não o fuso do navegador de quem acessa.

**Architecture:** Um novo utilitário `src/lib/nyTime.ts` centraliza toda leitura de data/hora em fuso de NY via `Intl.DateTimeFormat` (nativo, sem lib nova). `CalendarMonthView.tsx` passa a usá-lo (troca de comparação local por NY). Duas visualizações novas (`CalendarWeekView.tsx`, `CalendarDayView.tsx`) seguem o mesmo padrão de props (`cards` + `onSelectCard`) já usado pelo Mês. `CalendarView.tsx` vira um container de 3 vias em vez de 2, e `CalendarTimelineView.tsx` é removido.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 — sem dependências novas.

## Global Constraints

- Sem lib de calendário externa e sem lib de fuso horário — `Intl.DateTimeFormat` (nativo do JS) resolve o fuso de NY com DST automático.
- Todo bucketing de "qual dia é esse card" (nas 3 visualizações) e toda exibição de horário usam o fuso `America/New_York` — nunca o fuso do navegador de quem acessa.
- Mesma cor por formato (`src/lib/contentFormat.ts`, já existente) e mesmo `ContentCardModal` (já existente) reaproveitados nas 3 visualizações — nenhum dos dois é modificado neste plano.
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, scripts `node` isolados pra lógica pura de data, e checagem visual no Browser pane.
- Não mesclar em `main`/`staging` sem aprovação explícita do Victor.

---

### Task 1: `src/lib/nyTime.ts` + migrar `CalendarMonthView.tsx` pro fuso de NY

**Files:**
- Create: `src/lib/nyTime.ts`
- Modify: `src/components/CalendarMonthView.tsx` (arquivo inteiro será substituído)

**Interfaces:**
- Produces: `getNYDateParts(ms: number): { year: number; month: number; day: number; hour: number; minute: number }`, `isSameNYDay(ms: number, cell: { year: number; month: number; day: number }): boolean`, `formatNYTime(ms: number): string` — exportados de `src/lib/nyTime.ts`, consumidos por `CalendarMonthView.tsx` (esta task) e por `CalendarWeekView.tsx`/`CalendarDayView.tsx` (Tasks 2 e 3).

- [ ] **Step 1: Criar `src/lib/nyTime.ts`**

```ts
// src/lib/nyTime.ts
const NY_TIME_ZONE = "America/New_York";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: NY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type NYDateParts = {
  year: number;
  month: number; // 0-indexed, igual a Date.getMonth()
  day: number;
  hour: number;
  minute: number;
};

// ponytail: usa Intl.DateTimeFormat em vez de matemática de offset na mão — lida com
// DST automaticamente, sem precisar de uma lib de fuso horário.
export function getNYDateParts(ms: number): NYDateParts {
  const parts = partsFormatter.formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const hour = get("hour");
  return {
    year: get("year"),
    month: get("month") - 1,
    day: get("day"),
    hour: hour === 24 ? 0 : hour,
    minute: get("minute"),
  };
}

export function isSameNYDay(ms: number, cell: { year: number; month: number; day: number }): boolean {
  const p = getNYDateParts(ms);
  return p.year === cell.year && p.month === cell.month && p.day === cell.day;
}

export function formatNYTime(ms: number): string {
  const { hour, minute } = getNYDateParts(ms);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Verificar a lógica com um script Node isolado**

Não há framework de testes neste projeto. `Intl.DateTimeFormat` é JS puro (não precisa de TypeScript pra rodar), então verifique com um script `.mjs` temporário replicando a mesma lógica:

```bash
cat > /tmp/verify-nytime.mjs << 'EOF'
const NY_TIME_ZONE = "America/New_York";
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: NY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});
function getNYDateParts(ms) {
  const parts = partsFormatter.formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const hour = get("hour");
  return { year: get("year"), month: get("month") - 1, day: get("day"), hour: hour === 24 ? 0 : hour, minute: get("minute") };
}
function isSameNYDay(ms, cell) {
  const p = getNYDateParts(ms);
  return p.year === cell.year && p.month === cell.month && p.day === cell.day;
}
function formatNYTime(ms) {
  const { hour, minute } = getNYDateParts(ms);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { console.error(`FAIL ${label}: got ${a}, expected ${e}`); process.exitCode = 1; }
  else console.log(`OK ${label}`);
}

// card real da Débora, 2026-07-27T21:00:00Z, em Julho (EDT, UTC-4) -> 17:00 NY
assertEqual(getNYDateParts(Date.parse("2026-07-27T21:00:00.000Z")), { year: 2026, month: 6, day: 27, hour: 17, minute: 0 }, "julho EDT");
assertEqual(formatNYTime(Date.parse("2026-07-27T21:00:00.000Z")), "17:00", "formatNYTime julho");

// caso de virada de dia: 2026-01-15T04:30:00Z, em Janeiro (EST, UTC-5) -> 2026-01-14 23:30 NY
// (é exatamente o tipo de card que mudaria de dia se comparássemos em UTC ou fuso local errado)
assertEqual(getNYDateParts(Date.parse("2026-01-15T04:30:00.000Z")), { year: 2026, month: 0, day: 14, hour: 23, minute: 30 }, "virada de dia EST");
assertEqual(isSameNYDay(Date.parse("2026-01-15T04:30:00.000Z"), { year: 2026, month: 0, day: 14 }), true, "isSameNYDay dia anterior em UTC");
assertEqual(isSameNYDay(Date.parse("2026-01-15T04:30:00.000Z"), { year: 2026, month: 0, day: 15 }), false, "isSameNYDay NÃO é dia 15");
EOF
node /tmp/verify-nytime.mjs
rm /tmp/verify-nytime.mjs
```

Expected: todas as linhas `OK ...`, nenhuma `FAIL`.

- [ ] **Step 3: Substituir `src/components/CalendarMonthView.tsx` inteiro**

```tsx
// src/components/CalendarMonthView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";
import { getNYDateParts, isSameNYDay } from "@/lib/nyTime";

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

export function CalendarMonthView({
  cards,
  onSelectCard,
}: {
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const todayParts = getNYDateParts(Date.now());
  const [currentMonth, setCurrentMonth] = useState(new Date(todayParts.year, todayParts.month, 1));

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const cells = buildMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth());

  function cardsForDay(day: Date): ContentCardData[] {
    return datedCards.filter((c) =>
      isSameNYDay(c.dueDate!, { year: day.getFullYear(), month: day.getMonth(), day: day.getDate() })
    );
  }

  function isToday(day: Date): boolean {
    return day.getFullYear() === todayParts.year && day.getMonth() === todayParts.month && day.getDate() === todayParts.day;
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
                <p className={`mb-1 text-xs font-medium ${isToday(day) ? "text-brand-primary" : "text-muted-foreground"}`}>
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

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 6: Checagem visual — regressão pura**

Abrir `/tiago/calendario?key=b9d179192160c98b579807d25f8a956e`. Confirmar que a grade mensal se comporta exatamente como antes: navegação de mês, cards aparecendo nos dias certos, "hoje" destacado no dia certo, clique abrindo o `ContentCardModal`. Isso é regressão pura — a única mudança de comportamento esperada é o fuso usado internamente (não deve haver diferença visual perceptível pra cards que não estão perto da virada de dia).

- [ ] **Step 7: Commit**

```bash
git add src/lib/nyTime.ts src/components/CalendarMonthView.tsx
git commit -m "Adiciona nyTime.ts + migra CalendarMonthView pro fuso America/New_York"
```

---

### Task 2: `CalendarWeekView.tsx`

**Files:**
- Create: `src/components/CalendarWeekView.tsx`

**Interfaces:**
- Consumes: `getContentFormat`/`FORMAT_BAR_CLASSES` de `src/lib/contentFormat.ts`, `getNYDateParts`/`isSameNYDay` de `src/lib/nyTime.ts` (Task 1).
- Produces: `CalendarWeekView({ cards, onSelectCard }: { cards: ContentCard[]; onSelectCard: (card: ContentCard) => void })` — mesma assinatura de `CalendarMonthView`, consumida por `CalendarView.tsx` (Task 4).

- [ ] **Step 1: Criar `src/components/CalendarWeekView.tsx`**

```tsx
// src/components/CalendarWeekView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";
import { getNYDateParts, isSameNYDay } from "@/lib/nyTime";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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

// ponytail: year/month/day aqui são componentes de calendário puros (célula de grade), não um
// instante — igual ao padrão já usado em CalendarMonthView.
function getWeekStart(year: number, month: number, day: number): Date {
  const d = new Date(year, month, day);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function buildWeekGrid(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

export function CalendarWeekView({
  cards,
  onSelectCard,
}: {
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const todayParts = getNYDateParts(Date.now());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayParts.year, todayParts.month, todayParts.day));

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const days = buildWeekGrid(weekStart);

  function cardsForDay(day: Date): ContentCardData[] {
    return datedCards.filter((c) =>
      isSameNYDay(c.dueDate!, { year: day.getFullYear(), month: day.getMonth(), day: day.getDate() })
    );
  }

  function isToday(day: Date): boolean {
    return day.getFullYear() === todayParts.year && day.getMonth() === todayParts.month && day.getDate() === todayParts.day;
  }

  function goToPrevWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }

  function goToNextWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  const weekEnd = days[6];
  const rangeLabel = `${days[0].getDate()} ${MONTH_SHORT[days[0].getMonth()]} — ${weekEnd.getDate()} ${MONTH_SHORT[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-card-foreground">{rangeLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevWeek}
            aria-label="Semana anterior"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={goToNextWeek}
            aria-label="Próxima semana"
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
        {days.map((day, i) => (
          <div key={i} className="min-h-[180px] bg-card p-1.5">
            <p className={`mb-1 text-xs font-medium ${isToday(day) ? "text-brand-primary" : "text-muted-foreground"}`}>
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
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: erro esperado — `CalendarWeekView` ainda não é importado em nenhum lugar, então nenhum erro novo deve aparecer (o arquivo é standalone e type-safe sozinho). Se algum erro aparecer dentro de `CalendarWeekView.tsx`, corrija antes de prosseguir.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpo (o arquivo novo ainda não é importado por nenhuma rota, então não afeta o build).

- [ ] **Step 4: Commit**

```bash
git add src/components/CalendarWeekView.tsx
git commit -m "Adiciona CalendarWeekView.tsx (grade de 7 colunas, 1 semana por vez)"
```

---

### Task 3: `CalendarDayView.tsx`

**Files:**
- Create: `src/components/CalendarDayView.tsx`

**Interfaces:**
- Consumes: `getContentFormat`/`FORMAT_BAR_CLASSES` de `src/lib/contentFormat.ts`, `getNYDateParts`/`isSameNYDay`/`formatNYTime` de `src/lib/nyTime.ts` (Task 1).
- Produces: `CalendarDayView({ cards, onSelectCard }: { cards: ContentCard[]; onSelectCard: (card: ContentCard) => void })` — mesma assinatura de `CalendarMonthView`/`CalendarWeekView`, consumida por `CalendarView.tsx` (Task 4).

- [ ] **Step 1: Criar `src/components/CalendarDayView.tsx`**

```tsx
// src/components/CalendarDayView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";
import { getNYDateParts, isSameNYDay, formatNYTime } from "@/lib/nyTime";

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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

export function CalendarDayView({
  cards,
  onSelectCard,
}: {
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const todayParts = getNYDateParts(Date.now());
  const [currentDay, setCurrentDay] = useState(() => new Date(todayParts.year, todayParts.month, todayParts.day));

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const dayCards = datedCards
    .filter((c) =>
      isSameNYDay(c.dueDate!, { year: currentDay.getFullYear(), month: currentDay.getMonth(), day: currentDay.getDate() })
    )
    .sort((a, b) => a.dueDate! - b.dueDate!);

  function goToPrevDay() {
    setCurrentDay((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }

  function goToNextDay() {
    setCurrentDay((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }

  const label = `${WEEKDAY_LABELS[currentDay.getDay()]}, ${currentDay.getDate()} ${MONTH_SHORT[currentDay.getMonth()]} ${currentDay.getFullYear()}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-card-foreground">{label}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevDay}
            aria-label="Dia anterior"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={goToNextDay}
            aria-label="Próximo dia"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {dayCards.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-muted-foreground">Nenhum conteúdo agendado pra esse dia.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dayCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectCard(card)}
              className={`flex w-full items-center gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left transition-colors ${FORMAT_BAR_CLASSES[getContentFormat(card) ?? "default"]}`}
            >
              <span className="text-xs font-semibold tabular-nums">{formatNYTime(card.dueDate!)}</span>
              <span className="truncate text-sm font-medium">{card.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros novos (arquivo standalone, ainda não importado).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 4: Commit**

```bash
git add src/components/CalendarDayView.tsx
git commit -m "Adiciona CalendarDayView.tsx (lista de cards do dia ordenada por horário)"
```

---

### Task 4: Reescrever `CalendarView.tsx` (toggle Mês/Semana/Dia) + remover Timeline

**Files:**
- Modify: `src/components/CalendarView.tsx` (arquivo inteiro será substituído)
- Delete: `src/components/CalendarTimelineView.tsx`

**Interfaces:**
- Consumes: `CalendarMonthView` (Task 1, sem mudança de assinatura), `CalendarWeekView` (Task 2), `CalendarDayView` (Task 3) — todas com a assinatura `{ cards, onSelectCard }`.

- [ ] **Step 1: Deletar `src/components/CalendarTimelineView.tsx`**

```bash
rm "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost/src/components/CalendarTimelineView.tsx"
```

- [ ] **Step 2: Substituir `src/components/CalendarView.tsx` inteiro**

```tsx
// src/components/CalendarView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { ContentCardModal } from "./ContentCardModal";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarDayView } from "./CalendarDayView";

type ViewMode = "month" | "week" | "day";

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
          onClick={() => setViewMode("week")}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
            viewMode === "week" ? "bg-brand-primary/10 text-brand-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Semana
        </button>
        <button
          type="button"
          onClick={() => setViewMode("day")}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
            viewMode === "day" ? "bg-brand-primary/10 text-brand-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Dia
        </button>
      </div>

      {viewMode === "month" && <CalendarMonthView cards={cards} onSelectCard={setSelectedCard} />}
      {viewMode === "week" && <CalendarWeekView cards={cards} onSelectCard={setSelectedCard} />}
      {viewMode === "day" && <CalendarDayView cards={cards} onSelectCard={setSelectedCard} />}

      {selectedCard && (
        <ContentCardModal card={selectedCard} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Confirmar que não sobrou referência a "timeline"**

```bash
grep -ril "timeline" "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost/src"
```

Expected: nenhum resultado (comando não imprime nada).

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build limpo, `/[client]/calendario` presente na lista de rotas.

- [ ] **Step 6: Checagem visual completa**

Abrir `/tiago/calendario?key=b9d179192160c98b579807d25f8a956e` (15 cards com data, bom teste de volume) e `/debora/calendario?key=e5bff4d1825a067cfab62539526e9a3c` (cards com labels só de plataforma/dia da semana, formato vem do título — bom teste da detecção por título).

Confirmar:
- Toggle mostra só 3 opções: **Mês / Semana / Dia** (nenhum vestígio de "Timeline").
- "Mês" ativo por padrão, comportamento idêntico ao de antes.
- Clicar "Semana": grade de 7 colunas com só 1 semana, células mais altas, "hoje" destacado no dia certo, navegação semana anterior/próxima funciona, cor por formato correta, clique num card abre o modal certo.
- Clicar "Dia": lista vertical dos cards do dia atual (ou vazio, se não houver card na data de hoje), ordenados por horário, navegação dia anterior/próximo funciona, clique abre o modal certo.
- Conferir pelo menos 1 card real: o horário mostrado no Dia bate com o valor UTC bruto do card convertido pra NY (ex: um card com `dueDate` `2026-07-27T21:00:00.000Z` deve mostrar `17:00`, já que 27/Jul é período de horário de verão em NY, UTC-4).
- `read_console_messages` sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/CalendarView.tsx src/components/CalendarTimelineView.tsx
git commit -m "Reescreve CalendarView com toggle Mês/Semana/Dia, remove Timeline"
```
