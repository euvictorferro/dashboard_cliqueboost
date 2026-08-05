# Avaliação (popup de rating mensal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Popup que aparece pro cliente nos últimos 3 dias de cada mês (e continua aparecendo,
no máximo 1x/dia, até ele responder) pedindo uma avaliação de 0.5 a 5 estrelas + comentário
opcional, salva em `client_ratings`.

**Architecture:** Migration nova (`client_ratings`, RLS sem policies) → lib server-only
(`src/lib/ratings.ts`) → API route (`src/app/api/ratings/[client]/route.ts`, GET decide se
mostra + POST grava) → componente `RatingPopup` (portal pro `<body>`, dois estados: convite e
formulário) → plugado no `AppFrame` via `useEffect` que consulta a API e decide se renderiza o
popup.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind v4, Supabase (Service Role Key,
`@supabase/supabase-js` via `getSupabaseAdmin()` já existente em `src/lib/supabase.ts`).

## Global Constraints

- `client_id` é sempre `text`, slug do cliente, sem FK — mesma convenção de `bug_reports` /
  `referral_leads` / `client_settings`.
- Toda tabela nova: `enable row level security` e **sem nenhuma policy** — só a Service Role
  Key (server-only) acessa. Nunca importar `src/lib/ratings.ts` de um componente `"use client"`.
- `stars` sempre em passos de 0.5, entre 0.5 e 5 (nunca 0).
- Todo texto visível pro cliente em português, mesmo tom usado em `BugReportModal` (direto,
  sem gíria excessiva, com emoji pontual nas mensagens rotativas do popup de avaliação).
- Rotas de API seguem o padrão de `src/app/api/bug-reports/[client]/route.ts`: validam client
  existente em `CLIENTS`, validam token com `verifyClientToken`, retornam `Response.json` com
  status HTTP apropriado (`404`/`401`/`400`/`502`).
- Depois de cada task: `npx tsc --noEmit -p .` deve passar antes do commit.

---

### Task 1: Migration `client_ratings`

**Files:**
- Create: `supabase/migrations/0018_client_ratings.sql`

**Interfaces:**
- Produces: tabela `client_ratings(id uuid, client_id text, month_ref date, stars numeric(2,1),
  feedback text nullable, created_at timestamptz)`, constraint única `(client_id, month_ref)`,
  check `stars` entre 0.5 e 5 em passos de 0.5.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0018_client_ratings.sql
create table if not exists client_ratings (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  month_ref date not null,
  stars numeric(2,1) not null check (stars >= 0.5 and stars <= 5 and stars * 2 = round(stars * 2)),
  feedback text,
  created_at timestamptz not null default now(),
  unique (client_id, month_ref)
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela —
-- mesmo padrão de bug_reports/referral_leads.
alter table client_ratings enable row level security;
```

- [ ] **Step 2: Aplicar a migration no Supabase**

Não há CLI de migrations automatizada neste projeto (confirmado nas migrations anteriores —
Victor aplica manualmente). Copiar o SQL acima e enviar pro Victor aplicar no SQL editor do
Supabase (mesmo fluxo usado pra `0017_bug_reports.sql`). Aguardar confirmação antes de seguir
pra Task 3 (que depende da tabela existir pra ser testável ponta a ponta) — mas as Tasks 2 e
seguintes de código podem ser implementadas em paralelo, só o teste manual fica bloqueado.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0018_client_ratings.sql
git commit -m "feat(avaliacao): migration da tabela client_ratings"
```

---

### Task 2: Lib server-only `src/lib/ratings.ts`

**Files:**
- Create: `src/lib/ratings.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin()` de `src/lib/supabase.ts` (retorna cliente Supabase ou `null`
  se não configurado — mesmo formato usado em `src/lib/bugReports.ts`).
- Produces:
  - `computePendingMonth(now: Date, ratedMonths: string[]): string | null` — função pura,
    testável sem Supabase. Recebe a data atual e a lista de `month_ref` (formato
    `"YYYY-MM-DD"`) já avaliados, devolve o `month_ref` pendente (formato `"YYYY-MM-DD"`, dia
    sempre `01`) ou `null` se não há nada pendente.
  - `getPendingRatingMonth(clientId: string): Promise<string | null>` — busca os
    `month_ref` já avaliados do cliente no Supabase e chama `computePendingMonth(new Date(),
    ratedMonths)`.
  - `createRating(clientId: string, monthRef: string, stars: number, feedback: string |
    null): Promise<void>` — insere um registro em `client_ratings`.

- [ ] **Step 1: Escrever `computePendingMonth` com teste inline (self-check)**

Como não há framework de testes configurado no projeto (confirmar: não há `jest`/`vitest` no
`package.json` — o padrão do projeto é verificação manual via `tsc`/`build`/Playwright), a
regra do ponytail de "deixar 1 checagem executável" pra lógica não-trivial (esta função tem
ramificação de datas) é atendida com um `demo()` local que roda via `tsx`/`node` uma vez, sem
virar dependência nova nem arquivo de teste permanente. Escrever a função e, logo abaixo dela
no mesmo arquivo (fora de qualquer export, dentro de um bloco `if (require.main === module)`
não funciona em ESM/Next — em vez disso, validar manualmente com o comando abaixo depois de
implementar):

```typescript
// src/lib/ratings.ts
import { getSupabaseAdmin } from "./supabase";

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function monthRefOf(year: number, monthIndex0: number): string {
  const mm = String(monthIndex0 + 1).padStart(2, "0");
  return `${year}-${mm}-01`;
}

// Mês alvo = mês corrente, se hoje está nos últimos 3 dias dele e ele ainda não foi avaliado;
// senão, mês anterior, se ele ainda não foi avaliado (cobre quem não abriu o app nos últimos
// 3 dias daquele mês). Se ambos já avaliados (ou nenhum se aplica), não há pendência.
export function computePendingMonth(now: Date, ratedMonths: string[]): string | null {
  const rated = new Set(ratedMonths);
  const year = now.getFullYear();
  const monthIndex0 = now.getMonth();
  const day = now.getDate();
  const lastDay = lastDayOfMonth(year, monthIndex0);

  const currentMonthRef = monthRefOf(year, monthIndex0);
  const isInLastThreeDays = day > lastDay - 3;
  if (isInLastThreeDays && !rated.has(currentMonthRef)) return currentMonthRef;

  const prevMonthIndex0 = monthIndex0 === 0 ? 11 : monthIndex0 - 1;
  const prevYear = monthIndex0 === 0 ? year - 1 : year;
  const prevMonthRef = monthRefOf(prevYear, prevMonthIndex0);
  if (!rated.has(prevMonthRef)) return prevMonthRef;

  return null;
}

// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service
// Role Key via getSupabaseAdmin).
export async function getPendingRatingMonth(clientId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.from("client_ratings").select("month_ref").eq("client_id", clientId);
  const ratedMonths = (data ?? []).map((r) => r.month_ref as string);
  return computePendingMonth(new Date(), ratedMonths);
}

export async function createRating(
  clientId: string,
  monthRef: string,
  stars: number,
  feedback: string | null
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("client_ratings")
    .insert({ client_id: clientId, month_ref: monthRef, stars, feedback });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Rodar a checagem manual da lógica de datas**

Rodar via `npx tsx` (dependência de dev já presente no projeto — confirmar com `cat
package.json | grep tsx`; se não houver, usar `node --experimental-strip-types` ou um script
temporário em `/private/tmp/.../scratchpad` que importa a função compilada). Casos a validar
manualmente, imprimindo o resultado de `computePendingMonth`:

```typescript
// scratchpad/check-pending-month.ts (temporário, não commitar)
import { computePendingMonth } from "../src/lib/ratings";

console.log(computePendingMonth(new Date(2026, 6, 29), [])); // esperado: "2026-07-01" (dentro dos últimos 3 dias de julho, ainda não avaliado)
console.log(computePendingMonth(new Date(2026, 6, 29), ["2026-07-01"])); // esperado: "2026-06-01" (julho já avaliado; cai pro mês anterior, que também está pendente)
console.log(computePendingMonth(new Date(2026, 6, 15), [])); // esperado: "2026-06-01" (meio do mês, fora da janela de julho; junho nunca foi avaliado, então continua pendente indefinidamente até ser respondido — é o comportamento esperado pela spec)
console.log(computePendingMonth(new Date(2026, 6, 15), ["2026-06-01"])); // esperado: null (junho já avaliado, julho fora da janela ainda — nada pendente)
console.log(computePendingMonth(new Date(2026, 7, 1), [])); // esperado: "2026-07-01" (1º de agosto, fora da janela de agosto, mas julho pendente como mês anterior)
console.log(computePendingMonth(new Date(2026, 7, 1), ["2026-07-01", "2026-08-01"])); // esperado: null (tudo avaliado)
```

Conferir visualmente que os resultados batem com o comentário de cada linha. Se algum não
bater, ajustar a função antes de seguir. Apagar o script temporário depois (`rm
scratchpad/check-pending-month.ts` ou equivalente no diretório de scratchpad da sessão) — não
commitar.

- [ ] **Step 3: Rodar `tsc`**

Run: `npx tsc --noEmit -p .`
Expected: sem erros novos relacionados a `src/lib/ratings.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ratings.ts
git commit -m "feat(avaliacao): lib server-only com lógica de mês pendente e criação de rating"
```

---

### Task 3: API route `src/app/api/ratings/[client]/route.ts`

**Files:**
- Create: `src/app/api/ratings/[client]/route.ts`

**Interfaces:**
- Consumes: `CLIENTS` de `@/lib/clients` (array com `.id`), `verifyClientToken` de
  `@/lib/access`, `getPendingRatingMonth` e `createRating` de `@/lib/ratings` (Task 2).
- Produces:
  - `GET` → `200 { show: boolean, monthRef: string | null }` | `404 { error: "unknown_client"
    }` | `401 { error: "unauthorized" }`.
  - `POST` → `200 { ok: true }` | `404`/`401` iguais ao GET | `400 { error: "invalid_body" }` |
    `502 { error: "fetch_failed" }`. Body esperado: `{ month_ref: string, stars: number,
    feedback: string | null }`.

- [ ] **Step 1: Escrever a rota**

```typescript
// src/app/api/ratings/[client]/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientToken } from "@/lib/access";
import { getPendingRatingMonth, createRating } from "@/lib/ratings";

function isValidStars(value: unknown): value is number {
  return typeof value === "number" && value >= 0.5 && value <= 5 && value * 2 === Math.round(value * 2);
}

function isValidMonthRef(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-01$/.test(value);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const monthRef = await getPendingRatingMonth(clientId);
  return Response.json({ show: monthRef !== null, monthRef });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !isValidMonthRef(body.month_ref) || !isValidStars(body.stars)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const feedback = typeof body.feedback === "string" && body.feedback.trim().length > 0 ? body.feedback.trim() : null;

  try {
    await createRating(clientId, body.month_ref, body.stars, feedback);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[ratings] falha ao salvar rating de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Rodar `tsc`**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Testar a rota manualmente (depende da Task 1 aplicada no Supabase)**

Rodar `npm run dev` local, depois:

```bash
curl "http://localhost:3000/api/ratings/debora?key=e5bff4d1825a067cfab62539526e9a3c"
```

Expected: `200` com `{ "show": ..., "monthRef": ... }` (valores dependem da data atual e do
que já existe em `client_ratings` pro cliente `debora`). Se `client_ratings` ainda não foi
criada no Supabase (Task 1 Step 2 pendente), a chamada deve retornar `show: false, monthRef:
null` sem quebrar (porque `getSupabaseAdmin()` falha silenciosamente ou o `select` retorna
vazio) — se isso não acontecer, revisar tratamento de erro em `getPendingRatingMonth`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/ratings/[client]/route.ts"
git commit -m "feat(avaliacao): API GET/POST de ratings mensais"
```

---

### Task 4: Componente `RatingPopup`

**Files:**
- Create: `src/components/RatingPopup.tsx`

**Interfaces:**
- Consumes: nenhuma dependência de outro componente novo — usa `fetch` direto pra
  `/api/ratings/[client]` (Task 3).
- Produces: `RatingPopup({ clientId, accessKey, monthRef, dismissCount, onClose, onSubmitted
  })` — componente `"use client"`, exportado, usado pela Task 5.
  - `onClose(): void` — chamado ao clicar "Agora não" ou no X.
  - `onSubmitted(): void` — chamado depois do POST bem-sucedido.
  - `dismissCount: number` — quantas vezes o cliente já dispensou o popup pro mês corrente
    (usado pra escolher a mensagem rotativa); prop controlada pelo `AppFrame` (Task 5), que lê
    do localStorage.

- [ ] **Step 1: Escrever o componente**

```typescript
// src/components/RatingPopup.tsx
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

const INVITE_MESSAGES = [
  "Como está sendo sua experiência com a Clique Boost esse mês? Sua avaliação nos ajuda a evoluir!",
  "Ei, ainda não recebemos sua nota desse mês — leva 10 segundos, prometemos!",
  "Sei que já te perguntei, mas... avalia a gente aí? 👀",
  "Terceira tentativa! Sua opinião realmente importa pra gente (e pro seu contentzinho).",
  "Tá bom, última insistência por hoje: como foi o mês? 🙏",
];

const STAR_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function inviteMessageFor(dismissCount: number): string {
  const index = Math.min(dismissCount, INVITE_MESSAGES.length - 1);
  return INVITE_MESSAGES[index];
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: "full" | "half" | "empty" }) {
  const fillId = "rating-star-half";
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={fillId}>
          <stop offset="50%" stopColor="currentColor" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6L12 17l-5.9 3.6 1.4-6.6-5-4.6 6.6-.7L12 2.5z"
        fill={filled === "full" ? "currentColor" : filled === "half" ? `url(#${fillId})` : "none"}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Status = "invite" | "form" | "sending" | "sent";

export function RatingPopup({
  clientId,
  accessKey,
  monthRef,
  dismissCount,
  onClose,
  onSubmitted,
}: {
  clientId: string;
  accessKey: string;
  monthRef: string;
  dismissCount: number;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [status, setStatus] = useState<Status>("invite");
  const [stars, setStars] = useState<number | null>(null);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayStars = hoverStars ?? stars ?? 0;

  function handleSubmit() {
    if (!stars || status === "sending") return;
    setStatus("sending");
    setErrorMsg(null);

    fetch(`/api/ratings/${clientId}?key=${encodeURIComponent(accessKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month_ref: monthRef, stars, feedback: feedback.trim() || null }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("sent");
        onSubmitted();
      })
      .catch(() => {
        setStatus("form");
        setErrorMsg("Não foi possível enviar agora, tenta de novo.");
      });
  }

  // ponytail: portal pro <body> — mesmo motivo do BugReportModal (nasce dentro do AppFrame,
  // que tem a Sidebar com position:sticky, criando contexto de empilhamento próprio).
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        {status === "invite" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-card-foreground">{inviteMessageFor(dismissCount)}</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={() => setStatus("form")}
                className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
              >
                Avaliar
              </button>
            </div>
          </div>
        )}

        {(status === "form" || status === "sending") && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-card-foreground">Sua avaliação</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex justify-center gap-1 text-brand-primary" onMouseLeave={() => setHoverStars(null)}>
              {STAR_VALUES.map((value) => {
                const filled: "full" | "half" | "empty" =
                  displayStars >= value ? "full" : displayStars >= value - 0.5 ? "half" : "empty";
                return (
                  <button
                    key={value}
                    type="button"
                    onMouseEnter={() => setHoverStars(value)}
                    onClick={() => setStars(value)}
                    aria-label={`${value} estrelas`}
                    className="cursor-pointer"
                  >
                    <StarIcon filled={filled} />
                  </button>
                );
              })}
            </div>
            {stars !== null && <p className="text-center text-xs text-muted-foreground">{stars} de 5 estrelas</p>}

            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Conte mais, se quiser (opcional)"
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />

            {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!stars || status === "sending"}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-40"
            >
              {status === "sending" ? "Enviando..." : "Enviar"}
            </button>
          </div>
        )}

        {status === "sent" && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-sm font-semibold text-card-foreground">Valeu pela avaliação! 🎉</p>
            <p className="text-sm text-muted-foreground">Isso nos ajuda demais a melhorar a plataforma.</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 2: Rodar `tsc`**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/RatingPopup.tsx
git commit -m "feat(avaliacao): componente RatingPopup (convite + estrelas 0.5 em 0.5)"
```

---

### Task 5: Plugar no `AppFrame`

**Files:**
- Modify: `src/components/AppFrame.tsx`

**Interfaces:**
- Consumes: `RatingPopup` (Task 4), `GET /api/ratings/[client]` (Task 3).

- [ ] **Step 1: Adicionar o `useEffect` de checagem e o estado do popup**

Editar `src/components/AppFrame.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { CLIENTS } from "@/lib/clients";
import { Sidebar, type ActiveKey } from "./Sidebar";
import { Header } from "./Header";
import { CmdK } from "./CmdK";
import { RatingPopup } from "./RatingPopup";

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function AppFrame({
  clientId,
  accessKey,
  active,
  pageLabel,
  children,
}: {
  clientId: string;
  accessKey: string;
  active: ActiveKey;
  pageLabel: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingMonthRef, setPendingMonthRef] = useState<string | null>(null);
  const client = CLIENTS.find((c) => c.id === clientId);

  const dismissedKey = `rating-dismissed-${clientId}`;
  const dismissCountKey = `rating-dismiss-count-${clientId}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(dismissedKey) === todayKey()) return;

    fetch(`/api/ratings/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { show: boolean; monthRef: string | null } | null) => {
        if (data?.show && data.monthRef) setPendingMonthRef(data.monthRef);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, accessKey]);

  function handleDismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissedKey, todayKey());
      const count = Number(window.localStorage.getItem(dismissCountKey) ?? "0");
      window.localStorage.setItem(dismissCountKey, String(count + 1));
    }
    setPendingMonthRef(null);
  }

  function handleSubmitted() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(dismissCountKey);
    }
  }

  const dismissCount = typeof window !== "undefined" ? Number(window.localStorage.getItem(dismissCountKey) ?? "0") : 0;

  return (
    <div className="flex min-h-full items-start">
      <Sidebar clientId={clientId} accessKey={accessKey} active={active} pageLabel={pageLabel} collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          clientName={client?.name ?? clientId}
          pageLabel={pageLabel}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
        <div className="min-w-0">{children}</div>
      </div>
      <CmdK clientId={clientId} accessKey={accessKey} />
      {pendingMonthRef && (
        <RatingPopup
          clientId={clientId}
          accessKey={accessKey}
          monthRef={pendingMonthRef}
          dismissCount={dismissCount}
          onClose={handleDismiss}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rodar `tsc` e `build`**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

Run: `npm run build`
Expected: build passa sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppFrame.tsx
git commit -m "feat(avaliacao): plugar RatingPopup no AppFrame com throttle diário via localStorage"
```

---

### Task 6: Verificação end-to-end no preview

**Files:** nenhum arquivo novo — task de verificação manual.

**Interfaces:** nenhuma (consome tudo das Tasks 1-5).

- [ ] **Step 1: Confirmar que a migration da Task 1 foi aplicada pelo Victor no Supabase**

Perguntar/confirmar antes de seguir — sem a tabela `client_ratings` existir, os testes abaixo
não fazem sentido.

- [ ] **Step 2: Deploy preview**

```bash
vercel deploy
```

Capturar a URL de preview retornada.

- [ ] **Step 3: Liberar acesso do Playwright ao preview (Deployment Protection)**

```bash
vercel project protection enable --protection-bypass
```

Capturar o secret do output.

- [ ] **Step 4: Testar com Playwright MCP — cenário "dentro da janela, sem rating"**

Usar `mcp__playwright__browser_navigate` pra
`https://<preview-url>/debora?key=e5bff4d1825a067cfab62539526e9a3c&x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true`.

Se a data atual não estiver nos últimos 3 dias do mês, ajustar temporariamente
`isInLastThreeDays` em `src/lib/ratings.ts` pra sempre `true` (ou inserir um `console.log` de
debug), redeployar, testar, e reverter antes do commit final — não deixar código de debug
commitado. Confirmar: popup aparece, mensagem de convite bate com a primeira da lista, botões
"Agora não"/"Avaliar" funcionam, popup não fica atrás de nenhum elemento (tirar screenshot com
`mcp__playwright__browser_take_screenshot`).

- [ ] **Step 5: Testar fluxo de avaliação completo**

Clicar "Avaliar", selecionar uma nota (ex: 3.5 estrelas), escrever um feedback opcional,
enviar. Confirmar tela de agradecimento aparece e, no Supabase, a linha foi criada em
`client_ratings` com `stars = 3.5` e `month_ref` correto. Recarregar a página — popup não deve
aparecer de novo.

- [ ] **Step 6: Testar "Agora não" + throttle diário**

Em outro teste (remover a linha criada no passo anterior do Supabase pra resetar o estado, ou
usar um `month_ref` diferente), clicar "Agora não". Recarregar a página no mesmo dia —
confirmar que o popup NÃO aparece de novo (throttle de 1x/dia via localStorage). Não dá pra
testar o "reaparece no dia seguinte" sem viajar no tempo — validar essa parte só por leitura de
código (a chave `todayKey()` muda de valor a cada dia, então o `localStorage.getItem !==
todayKey()` naturalmente libera a checagem no dia seguinte).

- [ ] **Step 7: Desativar o Deployment Protection bypass**

```bash
vercel project protection disable --protection-bypass --protection-bypass-secret <secret>
```

- [ ] **Step 8: Limpar screenshots/snapshots temporários do Playwright**

```bash
git status --short
```

Confirmar que nenhum arquivo `.playwright-mcp/`, `.png` ou `.yml` de teste está staged antes de
qualquer commit.

- [ ] **Step 9: Reportar resultado pro Victor**

Mandar o link de preview e um resumo do que foi testado (mensagem de texto direta, sem
commit — esta task não gera código).
