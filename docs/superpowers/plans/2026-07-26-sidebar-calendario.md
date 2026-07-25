# Sidebar Social Media + Calendário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Conteúdos" na sidebar vira um grupo expansível "Social Media" com 3 subitens (Conteúdos/Calendário/Bunker), e a nova página Calendário mostra os cards do board do Trello com data numa grade mensal, abrindo o mesmo modal já usado no Kanban ao clicar.

**Architecture:** `Sidebar.tsx` vira um componente client (`useState` pro grupo expansível/colapsável) com um item de grupo + 3 links filhos. A página Calendário reusa a mesma rota `/api/content/[client]` já existente (sem mudança) — só achata as listas num array de cards e filtra os que têm `dueDate`. `CalendarView.tsx` é construído na mão (grade de 7 colunas com Tailwind, sem lib nova) e reaproveita `ContentCardModal` (já existe, não é tocado).

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 — sem dependências novas.

## Global Constraints

- O link "Bunker" na sidebar aponta pra `/bunker`, que ainda não existe nesse plano (fica 404 até o próximo plano) — comportamento esperado, não é bug.
- Card sem `dueDate` nunca aparece no Calendário.
- Só visualização de Mês nessa versão — sem Semana/Dia/Ano/Timeline.
- Clicar num card no Calendário abre exatamente o `ContentCardModal` já existente (`src/components/ContentCardModal.tsx`) — sem modificar esse arquivo.
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual no Browser pane.
- Não mesclar em `main`/`staging` sem aprovação explícita do Victor.

---

### Task 1: Sidebar — grupo "Social Media" expansível

**Files:**
- Modify: `src/components/Sidebar.tsx` (arquivo inteiro será substituído)

**Interfaces:**
- Produces: `Sidebar({ clientId, accessKey, active })` — `active` passa a aceitar `"dashboard" | "tasks" | "conteudos" | "calendario" | "bunker"` (antes só aceitava os 3 primeiros). Consumido por `src/app/[client]/page.tsx`, `src/app/[client]/tasks/page.tsx`, `src/app/[client]/conteudos/page.tsx` (já existentes, chamam com `active="dashboard"`/`"tasks"`/`"conteudos"` — continuam funcionando sem mudança) e pela nova página de Calendário (Task 2, vai chamar com `active="calendario"`).

- [ ] **Step 1: Reescrever `src/components/Sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="2" width="13" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 8.5l1.7 1.7L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="4" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7" y="2" width="4" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="2" width="4" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7h14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 2v3M12.5 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BunkerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 2l7 3.5v3c0 4-3 7-7 7.5-4-.5-7-3.5-7-7.5v-3L9 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 6v6M6.5 8.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SocialMediaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 8v2a1 1 0 0 0 1 1h1l3 3V4L5 7H4a1 1 0 0 0-1 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d="M11 6.5c.8.6 1.3 1.5 1.3 2.5s-.5 1.9-1.3 2.5M13 4.5c1.5 1.1 2.4 2.7 2.4 4.5S14.5 12.4 13 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ActiveKey = "dashboard" | "tasks" | "conteudos" | "calendario" | "bunker";

type NavItemDef = { href: string; label: string; key: ActiveKey; icon: () => React.JSX.Element };

const STANDALONE_ITEMS: NavItemDef[] = [
  { href: "", label: "Dashboard", key: "dashboard", icon: DashboardIcon },
  { href: "/tasks", label: "Tasks", key: "tasks", icon: TasksIcon },
];

const SOCIAL_MEDIA_ITEMS: NavItemDef[] = [
  { href: "/conteudos", label: "Conteúdos", key: "conteudos", icon: ContentIcon },
  { href: "/calendario", label: "Calendário", key: "calendario", icon: CalendarIcon },
  { href: "/bunker", label: "Bunker", key: "bunker", icon: BunkerIcon },
];

const SOCIAL_MEDIA_KEYS: ActiveKey[] = ["conteudos", "calendario", "bunker"];

function NavLink({
  clientId,
  accessKey,
  item,
  isActive,
}: {
  clientId: string;
  accessKey: string;
  item: NavItemDef;
  isActive: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={`/${clientId}${item.href}?key=${encodeURIComponent(accessKey)}`}
      className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-brand-primary/10 text-brand-primary"
          : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
      }`}
    >
      {isActive && (
        <span className="absolute -left-4 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-primary" aria-hidden="true" />
      )}
      <Icon />
      {item.label}
    </Link>
  );
}

export function Sidebar({
  clientId,
  accessKey,
  active,
}: {
  clientId: string;
  accessKey: string;
  active: ActiveKey;
}) {
  const isSocialActive = SOCIAL_MEDIA_KEYS.includes(active);
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const socialOpen = isSocialActive || manuallyOpen;

  return (
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-card px-4 py-6">
      <div className="px-2">
        <Logo />
      </div>

      <div>
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Menu</p>
        <div className="flex flex-col gap-1">
          {STANDALONE_ITEMS.map((item) => (
            <NavLink key={item.href} clientId={clientId} accessKey={accessKey} item={item} isActive={active === item.key} />
          ))}

          <button
            type="button"
            onClick={() => setManuallyOpen((o) => !o)}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
              isSocialActive ? "text-brand-primary" : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
            }`}
          >
            <SocialMediaIcon />
            <span className="flex-1">Social Media</span>
            <ChevronIcon open={socialOpen} />
          </button>

          {socialOpen && (
            <div className="ml-3 flex flex-col gap-1 border-l border-border pl-3">
              {SOCIAL_MEDIA_ITEMS.map((item) => (
                <NavLink key={item.href} clientId={clientId} accessKey={accessKey} item={item} isActive={active === item.key} />
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros novos relacionados a `Sidebar.tsx` (pode restar 1 erro esperado se alguma página futura ainda não existir — não é o caso aqui, `page.tsx` de `/calendario`/`/bunker` só são criadas depois, mas o `Sidebar.tsx` sozinho não referencia nada delas, só monta a `href` como string).

- [ ] **Step 3: Checagem visual no Browser pane**

Abrir `/debora/conteudos?key=e5bff4d1825a067cfab62539526e9a3c`: confirmar que o grupo "Social Media" aparece expandido automaticamente (porque `active="conteudos"`) com os 3 subitens, "Conteúdos" destacado. Clicar em "Dashboard": confirmar que o grupo fecha (não está mais numa página do grupo). Clicar no cabeçalho "Social Media" manualmente: confirmar que expande/colapsa. Confirmar que clicar em "Calendário" ou "Bunker" nesse momento dá 404 (esperado, páginas ainda não existem).

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "Sidebar: Conteúdos vira grupo expansível Social Media (Conteúdos/Calendário/Bunker)"
```

---

### Task 2: Rota e wiring da página Calendário

**Files:**
- Create: `src/app/[client]/calendario/page.tsx`
- Create: `src/components/CalendarPageClient.tsx`

**Interfaces:**
- Consumes: `Sidebar` (Task 1, `active="calendario"`), rota `/api/content/[client]` (já existe, sem mudança — devolve `{ lists: ContentList[] }`).
- Produces: `CalendarPageClient({ clientId, accessKey })` — usado só por `calendario/page.tsx`. Chama `CalendarView({ cards, clientId, accessKey })` (Task 3 — ainda não existe nesta task, então `tsc` vai acusar erro até a Task 3 terminar; isso é esperado, documentado no handoff pra Task 3).

- [ ] **Step 1: Criar `src/app/[client]/calendario/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { CalendarPageClient } from "@/components/CalendarPageClient";
import { verifyClientToken } from "@/lib/access";

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

  return (
    <div className="flex min-h-full">
      <Sidebar clientId={found.id} accessKey={key!} active="calendario" />
      <div className="min-w-0 flex-1">
        <CalendarPageClient clientId={found.id} accessKey={key!} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar `src/components/CalendarPageClient.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { ContentList } from "@/lib/trello";
import { CalendarView } from "./CalendarView";

type ErrorKind = "no_board" | "fetch_failed";

export function CalendarPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [lists, setLists] = useState<ContentList[] | null>(null);
  const [error, setError] = useState<ErrorKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLists(null);
    setError(null);
    fetch(`/api/content/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error === "no_board_configured" ? "no_board" : "fetch_failed");
        }
        return data as { lists: ContentList[] };
      })
      .then((data) => {
        if (!cancelled) setLists(data.lists);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message === "no_board" ? "no_board" : "fetch_failed");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey]);

  const errorMessage =
    error === "no_board"
      ? "Nenhum board configurado pra esse cliente."
      : "Não foi possível carregar os conteúdos agora.";

  const cards = lists ? lists.flatMap((l) => l.cards) : [];

  return (
    <div className="w-full py-10 pl-6 sm:pl-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Calendário</h1>
      {error && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          {errorMessage}
        </p>
      )}
      {!error && !lists && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!error && lists && <CalendarView cards={cards} clientId={clientId} accessKey={accessKey} />}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\[client\]/calendario/page.tsx src/components/CalendarPageClient.tsx
git commit -m "Adiciona rota /[client]/calendario (aguarda CalendarView da Task 3)"
```

Nota pro implementador: `npx tsc --noEmit` vai acusar erro nesta task (`CalendarView` não existe ainda) — isso é esperado, documentado no plano. Não tente criar `CalendarView.tsx` nesta task, é a Task 3.

---

### Task 3: `CalendarView` — grade mensal + integração com o modal

**Files:**
- Create: `src/components/CalendarView.tsx`

**Interfaces:**
- Consumes: `ContentCard` de `src/lib/trello.ts` (campos usados: `id`, `name`, `dueDate`). `ContentCardModal` de `src/components/ContentCardModal.tsx` (já existe, `{ card, clientId, accessKey, onClose }` — não modificar esse arquivo).
- Produces: `CalendarView({ cards, clientId, accessKey }: { cards: ContentCard[]; clientId: string; accessKey: string })` — consumido por `CalendarPageClient.tsx` (Task 2, já escrito esperando essa assinatura exata).

- [ ] **Step 1: Criar `src/components/CalendarView.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { ContentCardModal } from "./ContentCardModal";

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

export function CalendarView({
  cards,
  clientId,
  accessKey,
}: {
  cards: ContentCardData[];
  clientId: string;
  accessKey: string;
}) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedCard, setSelectedCard] = useState<ContentCardData | null>(null);

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
                      onClick={() => setSelectedCard(card)}
                      className="block w-full truncate rounded bg-brand-primary/10 px-1.5 py-1 text-left text-[11px] font-medium text-brand-primary hover:bg-brand-primary/20"
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

      {selectedCard && (
        <ContentCardModal card={selectedCard} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros — isso resolve o erro pendente deixado pela Task 2 (`CalendarView` agora existe com a assinatura esperada).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpo, `/[client]/calendario` aparece na lista de rotas.

- [ ] **Step 4: Checagem visual no Browser pane**

Abrir `/debora/calendario?key=e5bff4d1825a067cfab62539526e9a3c`. O board da Débora tem 1 card com `due` real — navegue pelos meses com as setas até achar a barra (comece pelo mês/ano atual e ande alguns meses pra trás/frente se não aparecer de cara). Confirmar: a grade mostra o mês certo, dias alinhados de domingo a sábado, o card aparece como uma barra compacta no dia certo (sem imagem, só nome truncado), clicar na barra abre o `ContentCardModal` com os dados certos do card, fechar funciona (X/Esc/clique fora, comportamento já existente do modal). Testar também com `/tiago/calendario?key=b9d179192160c98b579807d25f8a956e` (15 de 23 cards reais têm `due`) pra confirmar múltiplos cards no mesmo dia empilham corretamente e a navegação entre meses funciona pra achar todos. Confirmar que um card SEM data não aparece em nenhum dia. Checar `read_console_messages` sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/CalendarView.tsx
git commit -m "Adiciona CalendarView (grade mensal, sem lib externa) + integração com a página Calendário"
```
