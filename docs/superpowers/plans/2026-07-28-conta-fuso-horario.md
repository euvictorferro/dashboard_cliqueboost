# Página Conta — Fuso Horário do Cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o fuso horário do Calendário e das Atas configurável por cliente (só fusos dos EUA), com uma página "Conta" nova onde o cliente escolhe e salva.

**Architecture:** `src/lib/nyTime.ts` (fixo em NY) vira `src/lib/clientTime.ts` (genérico, recebe `timeZone` como parâmetro). Um novo `TimeZoneContext` evita threading manual de prop por 5 componentes — cada página server-side busca a preferência real do cliente (`client_settings`, tabela nova) e envolve a árvore client-side com o Provider. Uma rota de API (`GET`/`PUT /api/conta/[client]`) e uma página nova (`/[client]/conta`) deixam o cliente ler/trocar a preferência.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Supabase (`@supabase/supabase-js`) — sem dependências novas.

## Global Constraints

- Só 4 opções de fuso (EUA): `America/New_York` (default), `America/Chicago`, `America/Denver`, `America/Los_Angeles`.
- Página Conta, nesta rodada, mostra SÓ a seção de fuso horário — sem placeholders/"em breve" pras outras seções (Brand, Tempo de contrato, Briefing, Indicação de amigos), que ficam pra specs/planos futuros separados.
- A rodada não pode deixar o build quebrado em nenhum momento — a Task 1 migra `nyTime.ts` → `clientTime.ts` E atualiza todos os 6 consumidores existentes na mesma task (não dá pra fazer parcial sem quebrar o `tsc`).
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, script Node isolado, curl real, e checagem visual no Browser pane.
- Não mesclar em `main`/`staging` sem aprovação explícita do Victor.

## Handoff obrigatório antes da Task 1

Este plano cria uma migration nova (`supabase/migrations/0006_client_settings.sql`). O ambiente deste agente não tem acesso de aplicar migrations. Antes de prosseguir na Task 1:

1. O implementador da Task 1 deve criar o arquivo da migration, PARAR e avisar o controller/Victor, pedindo pra rodar o SQL no SQL Editor do Supabase (mesmo fluxo das migrations anteriores).
2. Só depois da confirmação, o implementador continua pro resto da Task 1.

---

### Task 1: `client_settings` + `clientTime.ts` (genérico) + `TimeZoneContext` + migrar os 6 consumidores

**Files:**
- Create: `supabase/migrations/0006_client_settings.sql`
- Create: `src/lib/clientSettings.ts`
- Create: `src/lib/clientTime.ts`
- Delete: `src/lib/nyTime.ts`
- Create: `src/components/TimeZoneContext.tsx`
- Modify: `src/components/CalendarMonthView.tsx` (arquivo inteiro será substituído)
- Modify: `src/components/CalendarWeekView.tsx` (arquivo inteiro será substituído)
- Modify: `src/components/CalendarDayView.tsx` (arquivo inteiro será substituído)
- Modify: `src/lib/formatCallDate.ts` (arquivo inteiro será substituído)
- Modify: `src/components/AtasList.tsx` (arquivo inteiro será substituído)
- Modify: `src/components/AtaDetailPageClient.tsx` (arquivo inteiro será substituído)

**Interfaces:**
- Produces: `DEFAULT_TIME_ZONE`, `US_TIMEZONES`, `getTimeZoneDateParts(ms, timeZone)`, `isSameTZDay(ms, cell, timeZone)`, `formatTZTime(ms, timeZone)` (de `clientTime.ts`); `TimeZoneProvider({ timeZone, children })`, `useTimeZone(): string` (de `TimeZoneContext.tsx`, fallback pro `DEFAULT_TIME_ZONE` se usado sem Provider); `fetchClientSettings(clientId): Promise<{ timeZone: string }>`, `updateClientSettings(clientId, timeZone): Promise<void>` (de `clientSettings.ts`) — consumidos pelas Tasks 2, 3 e 4.

Esta task é um REFACTOR + FUNDAÇÃO: nenhum `TimeZoneProvider` é montado em nenhuma página ainda (isso é Task 2/3), então `useTimeZone()` sempre cai no fallback `DEFAULT_TIME_ZONE = "America/New_York"` — o comportamento visual deve ficar EXATAMENTE igual ao de antes desta task, em todas as 5 telas afetadas (Mês/Semana/Dia do Calendário, lista e detalhe de Atas).

- [ ] **Step 1: Criar a migration `supabase/migrations/0006_client_settings.sql`**

```sql
create table if not exists client_settings (
  client_id text primary key,
  time_zone text not null default 'America/New_York'
);

alter table client_settings enable row level security;
```

- [ ] **Step 2: PARAR e pedir handoff**

Avise o controller/Victor: "Criei a migration `0006_client_settings.sql`. Preciso que você rode esse SQL no SQL Editor do Supabase antes de eu continuar." Espere a confirmação antes de prosseguir.

- [ ] **Step 3: Criar `src/lib/clientTime.ts`**

```ts
// src/lib/clientTime.ts
export const DEFAULT_TIME_ZONE = "America/New_York";

export const US_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Horário do Leste (ET)" },
  { value: "America/Chicago", label: "Horário Central (CT)" },
  { value: "America/Denver", label: "Horário da Montanha (MT)" },
  { value: "America/Los_Angeles", label: "Horário do Pacífico (PT)" },
];

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export type TimeZoneDateParts = {
  year: number;
  month: number; // 0-indexed, igual a Date.getMonth()
  day: number;
  hour: number;
  minute: number;
};

// ponytail: usa Intl.DateTimeFormat em vez de matemática de offset na mão — lida com DST
// automaticamente. Formatter cacheado por fuso (só 4 possíveis) pra não recriar a cada chamada.
export function getTimeZoneDateParts(ms: number, timeZone: string): TimeZoneDateParts {
  const parts = getPartsFormatter(timeZone).formatToParts(new Date(ms));
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

export function isSameTZDay(ms: number, cell: { year: number; month: number; day: number }, timeZone: string): boolean {
  const p = getTimeZoneDateParts(ms, timeZone);
  return p.year === cell.year && p.month === cell.month && p.day === cell.day;
}

export function formatTZTime(ms: number, timeZone: string): string {
  const { hour, minute } = getTimeZoneDateParts(ms, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Deletar `src/lib/nyTime.ts`**

```bash
git rm "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost/src/lib/nyTime.ts"
```

(`git rm` remove do disco e já deixa a remoção staged — o commit do Step 17 inclui essa remoção junto com o resto.)

- [ ] **Step 5: Criar `src/components/TimeZoneContext.tsx`**

```tsx
// src/components/TimeZoneContext.tsx
"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TIME_ZONE } from "@/lib/clientTime";

const TimeZoneContext = createContext<string>(DEFAULT_TIME_ZONE);

export function TimeZoneProvider({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  return <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>;
}

export function useTimeZone(): string {
  return useContext(TimeZoneContext);
}
```

- [ ] **Step 6: Criar `src/lib/clientSettings.ts`**

```ts
// src/lib/clientSettings.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";
import { DEFAULT_TIME_ZONE } from "./clientTime";

export async function fetchClientSettings(clientId: string): Promise<{ timeZone: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_settings")
    .select("time_zone")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { timeZone: data?.time_zone ?? DEFAULT_TIME_ZONE };
}

export async function updateClientSettings(clientId: string, timeZone: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("client_settings")
    .upsert({ client_id: clientId, time_zone: timeZone }, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 7: Substituir `src/components/CalendarMonthView.tsx` inteiro**

```tsx
// src/components/CalendarMonthView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";
import { getTimeZoneDateParts, isSameTZDay } from "@/lib/clientTime";
import { useTimeZone } from "./TimeZoneContext";

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
  const timeZone = useTimeZone();
  const todayParts = getTimeZoneDateParts(Date.now(), timeZone);
  const [currentMonth, setCurrentMonth] = useState(new Date(todayParts.year, todayParts.month, 1));

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const cells = buildMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth());

  function cardsForDay(day: Date): ContentCardData[] {
    return datedCards.filter((c) =>
      isSameTZDay(c.dueDate!, { year: day.getFullYear(), month: day.getMonth(), day: day.getDate() }, timeZone)
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

- [ ] **Step 8: Substituir `src/components/CalendarWeekView.tsx` inteiro**

```tsx
// src/components/CalendarWeekView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";
import { getTimeZoneDateParts, isSameTZDay } from "@/lib/clientTime";
import { useTimeZone } from "./TimeZoneContext";

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
  const timeZone = useTimeZone();
  const todayParts = getTimeZoneDateParts(Date.now(), timeZone);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayParts.year, todayParts.month, todayParts.day));

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const days = buildWeekGrid(weekStart);

  function cardsForDay(day: Date): ContentCardData[] {
    return datedCards.filter((c) =>
      isSameTZDay(c.dueDate!, { year: day.getFullYear(), month: day.getMonth(), day: day.getDate() }, timeZone)
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

- [ ] **Step 9: Substituir `src/components/CalendarDayView.tsx` inteiro**

```tsx
// src/components/CalendarDayView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";
import { getTimeZoneDateParts, isSameTZDay, formatTZTime } from "@/lib/clientTime";
import { useTimeZone } from "./TimeZoneContext";

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
  const timeZone = useTimeZone();
  const todayParts = getTimeZoneDateParts(Date.now(), timeZone);
  const [currentDay, setCurrentDay] = useState(() => new Date(todayParts.year, todayParts.month, todayParts.day));

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const dayCards = datedCards
    .filter((c) =>
      isSameTZDay(c.dueDate!, { year: currentDay.getFullYear(), month: currentDay.getMonth(), day: currentDay.getDate() }, timeZone)
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
              <span className="text-xs font-semibold tabular-nums">{formatTZTime(card.dueDate!, timeZone)}</span>
              <span className="truncate text-sm font-medium">{card.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 10: Substituir `src/lib/formatCallDate.ts` inteiro**

```ts
// src/lib/formatCallDate.ts
import { getTimeZoneDateParts } from "./clientTime";

const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// ponytail: weekday calculado a partir de year/month/day puros (componentes de calendário,
// não um instante) — mesmo padrão já usado em CalendarMonthView/CalendarWeekView.
export function formatCallDateHeader(callAt: number, timeZone: string, options?: { withYear?: boolean }): string {
  const { year, month, day } = getTimeZoneDateParts(callAt, timeZone);
  const weekday = new Date(year, month, day).getDay();
  const base = `${WEEKDAY_LABELS[weekday]}., ${day} de ${MONTH_LABELS[month]}.`;
  return options?.withYear ? `${base} de ${year}` : base;
}
```

- [ ] **Step 11: Substituir `src/components/AtasList.tsx` inteiro**

```tsx
// src/components/AtasList.tsx
"use client";

import Link from "next/link";
import type { CallNote } from "@/lib/callNotes";
import { formatCallDateHeader } from "@/lib/formatCallDate";
import { getTimeZoneDateParts, formatTZTime } from "@/lib/clientTime";
import { useTimeZone } from "./TimeZoneContext";

function FileTextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M5 2h5.5L14 5.5V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 8h5M6.5 10.5h5M6.5 13h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type DateGroup = { headerLabel: string; notes: CallNote[] };

// ponytail: notas já vêm ordenadas por callAt decrescente da API — só precisa agrupar
// consecutivas do mesmo dia-calendário no fuso do cliente, sem reordenar nada.
function groupByDay(notes: CallNote[], timeZone: string): DateGroup[] {
  const groups: DateGroup[] = [];
  let lastKey: string | null = null;

  for (const note of notes) {
    const parts = getTimeZoneDateParts(note.callAt, timeZone);
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    if (key !== lastKey) {
      groups.push({ headerLabel: formatCallDateHeader(note.callAt, timeZone), notes: [note] });
      lastKey = key;
    } else {
      groups[groups.length - 1].notes.push(note);
    }
  }
  return groups;
}

export function AtasList({
  notes,
  clientId,
  accessKey,
}: {
  notes: CallNote[];
  clientId: string;
  accessKey: string;
}) {
  const timeZone = useTimeZone();

  if (notes.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma ata registrada ainda.</p>
      </div>
    );
  }

  const groups = groupByDay(notes, timeZone);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.headerLabel + group.notes[0].id}>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{group.headerLabel}</p>
          <div className="space-y-2">
            {group.notes.map((note) => (
              <Link
                key={note.id}
                href={`/${clientId}/atas/${note.id}?key=${encodeURIComponent(accessKey)}`}
                className="flex items-center gap-3 rounded-[var(--radius-card)] bg-card px-4 py-3 shadow-[var(--shadow-soft)] transition-colors hover:bg-muted"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileTextIcon />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-card-foreground">{note.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatTZTime(note.callAt, timeZone)}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 12: Substituir `src/components/AtaDetailPageClient.tsx` inteiro**

```tsx
// src/components/AtaDetailPageClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { CallNote } from "@/lib/callNotes";
import { formatCallDateHeader } from "@/lib/formatCallDate";
import { formatTZTime } from "@/lib/clientTime";
import { useTimeZone } from "./TimeZoneContext";

type Status = "loading" | "error" | "not_found" | "success";

export function AtaDetailPageClient({
  clientId,
  accessKey,
  noteId,
}: {
  clientId: string;
  accessKey: string;
  noteId: string;
}) {
  const timeZone = useTimeZone();
  const [note, setNote] = useState<CallNote | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setNote(null);
    fetch(`/api/atas/${clientId}/${noteId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        if (res.status === 404) throw new Error("not_found");
        const data = await res.json();
        if (!res.ok) throw new Error("fetch_failed");
        return data as { note: CallNote };
      })
      .then((data) => {
        if (!cancelled) {
          setNote(data.note);
          setStatus("success");
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setStatus(err.message === "not_found" ? "not_found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey, noteId]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-10">
      <Link
        href={`/${clientId}/atas?key=${encodeURIComponent(accessKey)}`}
        className="mb-6 inline-block text-sm font-medium text-muted-foreground hover:text-card-foreground"
      >
        ← Voltar
      </Link>

      {status === "loading" && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {status === "error" && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Não foi possível carregar essa ata agora.
        </p>
      )}
      {status === "not_found" && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Ata não encontrada.
        </p>
      )}
      {status === "success" && note && (
        <div className="rounded-[var(--radius-card)] bg-card p-8 shadow-[var(--shadow-soft)]">
          <h1 className="text-2xl font-bold text-foreground">{note.title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            {formatCallDateHeader(note.callAt, timeZone, { withYear: true })} · {formatTZTime(note.callAt, timeZone)}
          </p>
          <ReactMarkdown
            components={{
              h1: (props) => <h2 className="mb-3 mt-6 text-lg font-bold text-card-foreground first:mt-0" {...props} />,
              h2: (props) => <h2 className="mb-3 mt-6 text-lg font-bold text-card-foreground first:mt-0" {...props} />,
              h3: (props) => <h3 className="mb-2 mt-5 text-base font-bold text-card-foreground first:mt-0" {...props} />,
              p: (props) => <p className="mb-3 text-sm text-card-foreground" {...props} />,
              ul: (props) => <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-card-foreground" {...props} />,
              ol: (props) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-card-foreground" {...props} />,
              li: (props) => <li {...props} />,
              strong: (props) => <strong className="font-bold" {...props} />,
            }}
          >
            {note.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 13: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 14: Verificar a lógica de fuso genérica com um script Node isolado**

```bash
cat > /tmp/verify-clienttime.mjs << 'EOF'
const formatterCache = new Map();
function getPartsFormatter(timeZone) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    formatterCache.set(timeZone, f);
  }
  return f;
}
function getTimeZoneDateParts(ms, timeZone) {
  const parts = getPartsFormatter(timeZone).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const hour = get("hour");
  return { year: get("year"), month: get("month") - 1, day: get("day"), hour: hour === 24 ? 0 : hour, minute: get("minute") };
}
function formatTZTime(ms, timeZone) {
  const { hour, minute } = getTimeZoneDateParts(ms, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { console.error(`FAIL ${label}: got ${a}, expected ${e}`); process.exitCode = 1; }
  else console.log(`OK ${label}`);
}

// mesmo instante (2026-07-09T15:00:00Z), fusos diferentes -> horas diferentes
assertEqual(formatTZTime(Date.parse("2026-07-09T15:00:00.000Z"), "America/New_York"), "11:00", "NY (EDT, UTC-4)");
assertEqual(formatTZTime(Date.parse("2026-07-09T15:00:00.000Z"), "America/Chicago"), "10:00", "Chicago (CDT, UTC-5)");
assertEqual(formatTZTime(Date.parse("2026-07-09T15:00:00.000Z"), "America/Denver"), "09:00", "Denver (MDT, UTC-6)");
assertEqual(formatTZTime(Date.parse("2026-07-09T15:00:00.000Z"), "America/Los_Angeles"), "08:00", "LA (PDT, UTC-7)");
EOF
node /tmp/verify-clienttime.mjs
rm /tmp/verify-clienttime.mjs
```

Expected: 4 linhas `OK ...`, nenhuma `FAIL` — confirma que o mesmo instante produz horas diferentes e corretas em cada um dos 4 fusos suportados.

- [ ] **Step 15: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 16: Checagem visual — regressão pura nas 5 telas afetadas**

Como nenhum `TimeZoneProvider` está montado ainda em nenhuma página, o comportamento deve ficar EXATAMENTE igual ao de antes desta task (fuso `America/New_York` implícito via fallback do Context). Abrir e conferir, sem nenhuma diferença visual perceptível:
- `/tiago/calendario?key=b9d179192160c98b579807d25f8a956e` — Mês, Semana, Dia (trocar entre os três).
- `/lais/atas?key=ecfc91088af28b32fb48d1dbcc46f626` — lista mostra a ata real com "11:00".
- `/lais/atas/43a2ddab-ee55-4c8c-8e8a-c7af67e7f9d9?key=ecfc91088af28b32fb48d1dbcc46f626` — detalhe mostra "11:00" também.

`read_console_messages` sem erros.

- [ ] **Step 17: Commit**

```bash
git add supabase/migrations/0006_client_settings.sql src/lib/clientSettings.ts src/lib/clientTime.ts src/components/TimeZoneContext.tsx src/components/CalendarMonthView.tsx src/components/CalendarWeekView.tsx src/components/CalendarDayView.tsx src/lib/formatCallDate.ts src/components/AtasList.tsx src/components/AtaDetailPageClient.tsx
git commit -m "Migra nyTime.ts pra clientTime.ts (fuso genérico) + TimeZoneContext + client_settings"
```

(A remoção de `src/lib/nyTime.ts`, já staged pelo `git rm` do Step 4, entra automaticamente neste mesmo commit.)

---

### Task 2: Ligar o Calendário à preferência real do cliente

**Files:**
- Modify: `src/app/[client]/calendario/page.tsx`

**Interfaces:**
- Consumes: `fetchClientSettings(clientId)` (Task 1), `TimeZoneProvider` (Task 1).

- [ ] **Step 1: Substituir `src/app/[client]/calendario/page.tsx` inteiro**

```tsx
// src/app/[client]/calendario/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { CalendarPageClient } from "@/components/CalendarPageClient";
import { TimeZoneProvider } from "@/components/TimeZoneContext";
import { verifyClientToken } from "@/lib/access";
import { fetchClientSettings } from "@/lib/clientSettings";

export default async function ClientCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { client } = await params;
  const { key } = await searchParams;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientToken(found.id, key);
  if (!authorized) return <AccessDenied />;

  const { timeZone } = await fetchClientSettings(found.id);

  return (
    <div className="flex min-h-full">
      <Sidebar clientId={found.id} accessKey={key!} active="calendario" />
      <div className="min-w-0 flex-1">
        <TimeZoneProvider timeZone={timeZone}>
          <CalendarPageClient clientId={found.id} accessKey={key!} />
        </TimeZoneProvider>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 4: Verificação real — trocar a preferência de um cliente de teste e confirmar efeito no Calendário**

```bash
set -a && source .env.local && set +a
curl -s -X POST "$SUPABASE_URL/rest/v1/client_settings" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"client_id": "tiago", "time_zone": "America/Los_Angeles"}'
```

Abrir `/tiago/calendario?key=b9d179192160c98b579807d25f8a956e`, ir na visualização de Dia com um card real do Tiago (ex: navegar até junho/2026), e confirmar que o horário mostrado é 3h antes do que era antes (ET → PT, diferença de 3h). Depois reverta:

```bash
curl -s -X DELETE "$SUPABASE_URL/rest/v1/client_settings?client_id=eq.tiago" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Recarregue a página e confirme que o horário voltou pro fuso Eastern (default, já que a linha de `client_settings` do Tiago não existe mais).

- [ ] **Step 5: Commit**

```bash
git add src/app/[client]/calendario/page.tsx
git commit -m "Liga o Calendário à preferência de fuso horário real do cliente"
```

---

### Task 3: Ligar as Atas à preferência real do cliente

**Files:**
- Modify: `src/app/[client]/atas/page.tsx`
- Modify: `src/app/[client]/atas/[id]/page.tsx`

**Interfaces:**
- Consumes: `fetchClientSettings(clientId)` (Task 1), `TimeZoneProvider` (Task 1).

- [ ] **Step 1: Substituir `src/app/[client]/atas/page.tsx` inteiro**

```tsx
// src/app/[client]/atas/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { AtasPageClient } from "@/components/AtasPageClient";
import { TimeZoneProvider } from "@/components/TimeZoneContext";
import { verifyClientToken } from "@/lib/access";
import { fetchClientSettings } from "@/lib/clientSettings";

export default async function ClientAtasPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { client } = await params;
  const { key } = await searchParams;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientToken(found.id, key);
  if (!authorized) return <AccessDenied />;

  const { timeZone } = await fetchClientSettings(found.id);

  return (
    <div className="flex min-h-full">
      <Sidebar clientId={found.id} accessKey={key!} active="atas" />
      <div className="min-w-0 flex-1">
        <TimeZoneProvider timeZone={timeZone}>
          <AtasPageClient clientId={found.id} accessKey={key!} />
        </TimeZoneProvider>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Substituir `src/app/[client]/atas/[id]/page.tsx` inteiro**

```tsx
// src/app/[client]/atas/[id]/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { AtaDetailPageClient } from "@/components/AtaDetailPageClient";
import { TimeZoneProvider } from "@/components/TimeZoneContext";
import { verifyClientToken } from "@/lib/access";
import { fetchClientSettings } from "@/lib/clientSettings";

export default async function ClientAtaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string; id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { client, id } = await params;
  const { key } = await searchParams;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientToken(found.id, key);
  if (!authorized) return <AccessDenied />;

  const { timeZone } = await fetchClientSettings(found.id);

  return (
    <div className="flex min-h-full">
      <Sidebar clientId={found.id} accessKey={key!} active="atas" />
      <div className="min-w-0 flex-1">
        <TimeZoneProvider timeZone={timeZone}>
          <AtaDetailPageClient clientId={found.id} accessKey={key!} noteId={id} />
        </TimeZoneProvider>
      </div>
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

- [ ] **Step 5: Verificação real — trocar a preferência da Laís e confirmar efeito na Atas**

```bash
set -a && source .env.local && set +a
curl -s -X POST "$SUPABASE_URL/rest/v1/client_settings" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"client_id": "lais", "time_zone": "America/Chicago"}'
```

Abrir `/lais/atas?key=ecfc91088af28b32fb48d1dbcc46f626` e confirmar que a ata real agora mostra "10:00" (era "11:00" em ET, Chicago é 1h atrás). Abrir o detalhe e confirmar o mesmo horário lá. Depois reverta:

```bash
curl -s -X DELETE "$SUPABASE_URL/rest/v1/client_settings?client_id=eq.lais" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Recarregue e confirme que voltou pra "11:00" (default Eastern).

- [ ] **Step 6: Commit**

```bash
git add "src/app/[client]/atas/page.tsx" "src/app/[client]/atas/[id]/page.tsx"
git commit -m "Liga a página Atas à preferência de fuso horário real do cliente"
```

---

### Task 4: Rota de API + Sidebar + página Conta

**Files:**
- Create: `src/app/api/conta/[client]/route.ts`
- Modify: `src/components/Sidebar.tsx`
- Create: `src/app/[client]/conta/page.tsx`
- Create: `src/components/ContaPageClient.tsx`

**Interfaces:**
- Consumes: `fetchClientSettings`/`updateClientSettings` (Task 1), `US_TIMEZONES` (Task 1).
- Produces: `GET`/`PUT /api/conta/[client]?key=TOKEN`, rota `/[client]/conta` navegável a partir da Sidebar.

- [ ] **Step 1: Criar `src/app/api/conta/[client]/route.ts`**

```ts
// src/app/api/conta/[client]/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchClientSettings, updateClientSettings } from "@/lib/clientSettings";
import { verifyClientToken } from "@/lib/access";
import { US_TIMEZONES } from "@/lib/clientTime";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const settings = await fetchClientSettings(clientId);
    return Response.json(settings);
  } catch (err) {
    console.error(`[conta] falha ao buscar configurações de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const timeZone = body?.timeZone;
  if (typeof timeZone !== "string" || !US_TIMEZONES.some((tz) => tz.value === timeZone)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await updateClientSettings(clientId, timeZone);
    return Response.json({ timeZone });
  } catch (err) {
    console.error(`[conta] falha ao salvar configurações de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Modificar `src/components/Sidebar.tsx` — adicionar item "Conta"**

Adicione o ícone novo logo depois de `function AtasIcon() { ... }`:

```tsx
function ContaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 15c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
```

Troque a linha `type ActiveKey = "dashboard" | "tasks" | "atas" | "conteudos" | "calendario" | "bunker";` por:

```tsx
type ActiveKey = "dashboard" | "tasks" | "atas" | "conta" | "conteudos" | "calendario" | "bunker";
```

Troque o array `STANDALONE_ITEMS` por:

```tsx
const STANDALONE_ITEMS: NavItemDef[] = [
  { href: "", label: "Dashboard", key: "dashboard", icon: DashboardIcon },
  { href: "/tasks", label: "Tasks", key: "tasks", icon: TasksIcon },
  { href: "/atas", label: "Atas", key: "atas", icon: AtasIcon },
  { href: "/conta", label: "Conta", key: "conta", icon: ContaIcon },
];
```

Nada mais no arquivo muda.

- [ ] **Step 3: Criar `src/app/[client]/conta/page.tsx`**

```tsx
// src/app/[client]/conta/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { ContaPageClient } from "@/components/ContaPageClient";
import { verifyClientToken } from "@/lib/access";

export default async function ClientContaPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { client } = await params;
  const { key } = await searchParams;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientToken(found.id, key);
  if (!authorized) return <AccessDenied />;

  return (
    <div className="flex min-h-full">
      <Sidebar clientId={found.id} accessKey={key!} active="conta" />
      <div className="min-w-0 flex-1">
        <ContaPageClient clientId={found.id} accessKey={key!} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Criar `src/components/ContaPageClient.tsx`**

```tsx
// src/components/ContaPageClient.tsx
"use client";

import { useEffect, useState } from "react";
import { US_TIMEZONES } from "@/lib/clientTime";

type Status = "loading" | "error" | "ready";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ContaPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [timeZone, setTimeZone] = useState<string>("America/New_York");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { timeZone: string };
      })
      .then((data) => {
        if (!cancelled) {
          setTimeZone(data.timeZone);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey]);

  function handleSave() {
    setSaveStatus("saving");
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setSaveStatus("saved");
      })
      .catch(() => setSaveStatus("error"));
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Conta</h1>

      {status === "loading" && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {status === "error" && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Não foi possível carregar as configurações agora.
        </p>
      )}
      {status === "ready" && (
        <div className="max-w-md rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="mb-1 text-sm font-bold text-card-foreground">Fuso horário</h2>
          <p className="mb-4 text-xs text-muted-foreground">Define o horário exibido no Calendário e nas Atas.</p>
          <select
            value={timeZone}
            onChange={(e) => {
              setTimeZone(e.target.value);
              setSaveStatus("idle");
            }}
            className="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Salvando..." : "Salvar"}
          </button>
          {saveStatus === "saved" && <p className="mt-2 text-xs text-green-600">Salvo com sucesso.</p>}
          {saveStatus === "error" && <p className="mt-2 text-xs text-red-500">Não foi possível salvar.</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build limpo, `ƒ /api/conta/[client]` e `ƒ /[client]/conta` presentes na lista de rotas.

- [ ] **Step 7: Verificação real ao vivo — 404/401/200 e o fluxo de salvar**

```bash
# 404: cliente inexistente
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/conta/naoexiste?key=qualquer"
# esperado: 404

# 401: token errado
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/conta/tiago?key=chaveerrada"
# esperado: 401

# 200: token certo, sem preferência salva ainda -> default
curl -s "http://localhost:3001/api/conta/tiago?key=b9d179192160c98b579807d25f8a956e"
# esperado: {"timeZone":"America/New_York"}

# PUT com valor inválido -> 400
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "http://localhost:3001/api/conta/tiago?key=b9d179192160c98b579807d25f8a956e" -H "Content-Type: application/json" -d '{"timeZone":"Europe/Lisbon"}'
# esperado: 400

# PUT com valor válido -> 200
curl -s -X PUT "http://localhost:3001/api/conta/tiago?key=b9d179192160c98b579807d25f8a956e" -H "Content-Type: application/json" -d '{"timeZone":"America/Denver"}'
# esperado: {"timeZone":"America/Denver"}

# GET de novo -> confirma que persistiu
curl -s "http://localhost:3001/api/conta/tiago?key=b9d179192160c98b579807d25f8a956e"
# esperado: {"timeZone":"America/Denver"}
```

Depois de confirmar, reverta pro default (Tiago é o cliente de teste usado nas verificações deste projeto — não deixe uma preferência de teste permanente):

```bash
set -a && source .env.local && set +a
curl -s -X DELETE "$SUPABASE_URL/rest/v1/client_settings?client_id=eq.tiago" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

- [ ] **Step 8: Checagem visual completa**

Abrir `/tiago/conta?key=b9d179192160c98b579807d25f8a956e`. Confirmar:
- Item "Conta" na Sidebar, entre "Atas" e o grupo "Social Media", destacado quando ativo.
- Dropdown mostra "Horário do Leste (ET)" selecionado (default, já que a preferência de teste foi revertida no Step 7).
- Trocar pra "Horário da Montanha (MT)", clicar "Salvar", ver "Salvo com sucesso.".
- Recarregar a página — o dropdown continua mostrando "Horário da Montanha (MT)" (persistiu de verdade).
- Ir em `/tiago/calendario?key=...` e confirmar que os horários mudaram de acordo (2h a menos que Eastern).
- Voltar em `/tiago/conta?key=...`, trocar de volta pra "Horário do Leste (ET)" e salvar (deixar o cliente de teste no estado default ao final da verificação).
- `read_console_messages` sem erros.

- [ ] **Step 9: Commit**

```bash
git add "src/app/api/conta/[client]/route.ts" src/components/Sidebar.tsx "src/app/[client]/conta/page.tsx" src/components/ContaPageClient.tsx
git commit -m "Adiciona rota de API + Sidebar + página Conta (fuso horário)"
```
