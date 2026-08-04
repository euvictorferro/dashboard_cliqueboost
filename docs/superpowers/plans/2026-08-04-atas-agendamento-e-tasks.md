# Atas — Agendamento de Call + Extração de Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente agenda/remarca call direto na página Atas (horários reais do Google Calendar do Victor) e, na página de detalhe de uma ata, um botão "Extrair tasks" manda o texto pra IA e cria as tasks identificadas no ClickUp.

**Architecture:** Duas fatias independentes que só compartilham a página Atas. Fatia 1 (Tasks 1-4): tabela `client_calls` + client Google Calendar (JWT de service account, sem SDK) + rotas de slots/agendamento + UI. Fatia 2 (Tasks 5-7): coluna `tasks_extracted_at` + `createTask` no ClickUp + client Anthropic (fetch direto, sem SDK) + rota de extração + UI.

**Tech Stack:** Next.js App Router, Supabase (Postgres), TypeScript, Google Calendar REST API (auth via JWT assinado com `node:crypto`, sem `googleapis`), Anthropic Messages API (fetch direto, sem `@anthropic-ai/sdk`), ClickUp REST API (já em uso).

## Global Constraints

- Nenhuma rota nova usa SDK externo — todo o projeto já chama APIs de terceiros (ClickUp, Trello, Meta) via `fetch` cru; Google e Anthropic seguem o mesmo padrão.
- Todas as rotas client-facing (`/api/atas/[client]/...`) exigem `verifyClientToken` — mesmo padrão de toda rota existente sob `/api/atas`.
- `src/lib/*.ts` que usam a Service Role Key ou tokens secretos levam o comentário `// ponytail: server-only — nunca importar isto de um componente "use client"`, igual aos libs existentes.
- Migrations vão em `supabase/migrations/`, sempre com RLS ligado e sem policies (Service Role only) — o Victor roda cada migration no SQL Editor do Supabase antes da task que depende dela (mesmo handoff das rodadas anteriores).
- Variáveis de ambiente novas (`GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `ANTHROPIC_API_KEY`) são fornecidas pelo Victor — não inventar valores, checar `process.env` e falhar com erro claro se ausente (mesmo padrão de `getSupabaseAdmin()` retornando `null`/lançando erro).
- Verificação de cada task é `npx tsc --noEmit` limpo + checagem manual (curl ou navegador) — o projeto não tem suíte de testes automatizados; seguir esse padrão, não introduzir um framework de testes novo.

---

### Task 1: Migration `client_calls` + `src/lib/clientCalls.ts`

**Files:**
- Create: `supabase/migrations/0013_client_calls.sql`
- Create: `src/lib/clientCalls.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin` de `src/lib/supabase.ts` (já existe).
- Produces: `ClientCall = { id: string; scheduledAt: number }`; `fetchActiveCall(clientId: string): Promise<ClientCall | null>`; `createCall(clientId: string, scheduledAt: number, googleEventId: string): Promise<ClientCall>`; `cancelActiveCall(clientId: string): Promise<{ googleEventId: string } | null>` exportadas de `src/lib/clientCalls.ts`.

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0013_client_calls.sql
create table if not exists client_calls (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  scheduled_at timestamptz not null,
  google_event_id text not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

alter table client_calls enable row level security;
```

O Victor roda essa migration no SQL Editor do Supabase antes do próximo passo.

- [ ] **Step 2: Criar `src/lib/clientCalls.ts`**

```ts
// src/lib/clientCalls.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export type ClientCall = { id: string; scheduledAt: number };

export async function fetchActiveCall(clientId: string): Promise<ClientCall | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_calls")
    .select("id, scheduled_at")
    .eq("client_id", clientId)
    .eq("status", "scheduled")
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: data.id, scheduledAt: Date.parse(data.scheduled_at) };
}

export async function createCall(clientId: string, scheduledAt: number, googleEventId: string): Promise<ClientCall> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_calls")
    .insert({
      client_id: clientId,
      scheduled_at: new Date(scheduledAt).toISOString(),
      google_event_id: googleEventId,
    })
    .select("id, scheduled_at")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, scheduledAt: Date.parse(data.scheduled_at) };
}

export async function cancelActiveCall(clientId: string): Promise<{ googleEventId: string } | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data: active, error: findError } = await supabase
    .from("client_calls")
    .select("id, google_event_id")
    .eq("client_id", clientId)
    .eq("status", "scheduled")
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!active) return null;

  const { error: updateError } = await supabase.from("client_calls").update({ status: "cancelled" }).eq("id", active.id);
  if (updateError) throw new Error(updateError.message);
  return { googleEventId: active.google_event_id };
}
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `clientCalls.ts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0013_client_calls.sql src/lib/clientCalls.ts
git commit -m "feat: tabela client_calls + camada de dados"
```

---

### Task 2: `src/lib/googleCalendar.ts` — auth JWT + slots livres + criar/cancelar evento

**Files:**
- Create: `src/lib/googleCalendar.ts`

**Interfaces:**
- Consumes: `process.env.GOOGLE_SERVICE_ACCOUNT_KEY` (JSON stringificado da service account), `process.env.GOOGLE_CALENDAR_ID`.
- Produces: `fetchFreeSlots(daysAhead: number): Promise<number[]>` (array de timestamps epoch ms, início de slots de 30 min livres, 9h-17h horário `America/New_York`, dias úteis); `createCallEvent(startMs: number, description: string): Promise<string>` (retorna o `google_event_id`); `cancelCallEvent(eventId: string): Promise<void>`.

- [ ] **Step 1: Criar `src/lib/googleCalendar.ts`**

```ts
// src/lib/googleCalendar.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a chave da service account).
import { createSign } from "node:crypto";

const SLOT_MINUTES = 30;
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 17;
const TIME_ZONE = "America/New_York";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function getServiceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY não configurada");
  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY inválida");
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

async function getAccessToken(): Promise<string> {
  const { client_email, private_key } = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: client_email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(private_key, "base64url");
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google_auth_failed: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

function calendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error("GOOGLE_CALENDAR_ID não configurada");
  return id;
}

function candidateSlots(daysAhead: number): number[] {
  const slots: number[] = [];
  const now = new Date();
  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) continue; // fim de semana fora
    for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
        const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
        if (slot.getTime() > now.getTime()) slots.push(slot.getTime());
      }
    }
  }
  return slots;
}

export async function fetchFreeSlots(daysAhead: number): Promise<number[]> {
  const accessToken = await getAccessToken();
  const candidates = candidateSlots(daysAhead);
  if (candidates.length === 0) return [];

  const timeMin = new Date(candidates[0]).toISOString();
  const timeMax = new Date(candidates[candidates.length - 1] + SLOT_MINUTES * 60_000).toISOString();

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId() }] }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google_freebusy_failed: ${JSON.stringify(json)}`);

  const busy: { start: string; end: string }[] = json.calendars?.[calendarId()]?.busy ?? [];
  const busyRanges = busy.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));

  return candidates.filter((slotStart) => {
    const slotEnd = slotStart + SLOT_MINUTES * 60_000;
    return !busyRanges.some((b) => slotStart < b.end && slotEnd > b.start);
  });
}

export async function createCallEvent(startMs: number, description: string): Promise<string> {
  const accessToken = await getAccessToken();
  const endMs = startMs + SLOT_MINUTES * 60_000;
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: "Call — Clique Boost",
      description,
      start: { dateTime: new Date(startMs).toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: new Date(endMs).toISOString(), timeZone: TIME_ZONE },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google_create_event_failed: ${JSON.stringify(json)}`);
  return json.id as string;
}

export async function cancelCallEvent(eventId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok && res.status !== 410) {
    const text = await res.text();
    throw new Error(`google_cancel_event_failed: ${text}`);
  }
}
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `googleCalendar.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/googleCalendar.ts
git commit -m "feat: client Google Calendar (auth JWT + slots + criar/cancelar evento)"
```

---

### Task 3: Rotas `GET /api/atas/[client]/call` e `POST /api/atas/[client]/call`

**Files:**
- Create: `src/app/api/atas/[client]/call/route.ts`

**Interfaces:**
- Consumes: `verifyClientToken` de `src/lib/access.ts`; `CLIENTS` de `src/lib/clients.ts`; `fetchActiveCall`/`createCall`/`cancelActiveCall` de `src/lib/clientCalls.ts`; `fetchFreeSlots`/`createCallEvent`/`cancelCallEvent` de `src/lib/googleCalendar.ts`.
- Produces: `GET` retorna `{ activeCall: { id: string; scheduledAt: number } | null; freeSlots: number[] }`. `POST` aceita `{ scheduledAt: number }` no body, retorna `{ call: { id: string; scheduledAt: number } }`.

- [ ] **Step 1: Criar a rota**

```ts
// src/app/api/atas/[client]/call/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientToken } from "@/lib/access";
import { fetchActiveCall, createCall, cancelActiveCall } from "@/lib/clientCalls";
import { fetchFreeSlots, createCallEvent, cancelCallEvent } from "@/lib/googleCalendar";

const DAYS_AHEAD = 10;

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const [activeCall, freeSlots] = await Promise.all([fetchActiveCall(clientId), fetchFreeSlots(DAYS_AHEAD)]);
    return Response.json({ activeCall, freeSlots });
  } catch (err) {
    console.error(`[atas/call] falha ao buscar disponibilidade de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const scheduledAt = body?.scheduledAt;
  if (typeof scheduledAt !== "number" || scheduledAt <= Date.now()) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const cancelled = await cancelActiveCall(clientId);
    if (cancelled) await cancelCallEvent(cancelled.googleEventId);

    const googleEventId = await createCallEvent(scheduledAt, `Call com ${client.name} (Clique Boost)`);
    const call = await createCall(clientId, scheduledAt, googleEventId);
    return Response.json({ call });
  } catch (err) {
    console.error(`[atas/call] falha ao agendar call de ${clientId}:`, err);
    return Response.json({ error: "schedule_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados à rota.

- [ ] **Step 3: Verificação manual**

Com `GOOGLE_SERVICE_ACCOUNT_KEY` e `GOOGLE_CALENDAR_ID` já configuradas em `.env.local` (fornecidas pelo Victor) e `npm run dev` rodando:

```bash
curl -s "http://localhost:3000/api/atas/debora/call?key=<token_real>" | python3 -m json.tool
```

Expected: JSON com `activeCall` (null se não houver call futura) e `freeSlots` como array de timestamps.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/atas/\[client\]/call/route.ts
git commit -m "feat: rotas GET/POST /api/atas/[client]/call (agendamento de call)"
```

---

### Task 4: UI de agendamento na página Atas

**Files:**
- Create: `src/components/CallScheduler.tsx`
- Modify: `src/components/AtasPageClient.tsx`

**Interfaces:**
- Consumes: `GET /api/atas/[client]/call` e `POST /api/atas/[client]/call` (Task 3).
- Produces: componente `CallScheduler({ clientId, accessKey }: { clientId: string; accessKey: string })`, usado dentro de `AtasPageClient`.

- [ ] **Step 1: Criar `src/components/CallScheduler.tsx`**

```tsx
// src/components/CallScheduler.tsx
"use client";

import { useEffect, useState } from "react";
import { useTimeZone } from "./TimeZoneContext";
import { formatTZTime } from "@/lib/clientTime";
import { formatCallDateHeader } from "@/lib/formatCallDate";

type CallInfo = { id: string; scheduledAt: number };
type Status = "loading" | "error" | "ready";

export function CallScheduler({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const timeZone = useTimeZone();
  const [status, setStatus] = useState<Status>("loading");
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);
  const [freeSlots, setFreeSlots] = useState<number[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  function load() {
    setStatus("loading");
    fetch(`/api/atas/${clientId}/call?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { activeCall: CallInfo | null; freeSlots: number[] };
      })
      .then((data) => {
        setActiveCall(data.activeCall);
        setFreeSlots(data.freeSlots);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  useEffect(load, [clientId, accessKey]);

  function schedule(slot: number) {
    setScheduling(true);
    fetch(`/api/atas/${clientId}/call?key=${encodeURIComponent(accessKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: slot }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setShowPicker(false);
        load();
      })
      .catch(() => setStatus("error"))
      .finally(() => setScheduling(false));
  }

  if (status === "loading") return <p className="text-sm text-muted-foreground">Carregando disponibilidade...</p>;
  if (status === "error") {
    return (
      <p className="rounded-[var(--radius-card)] bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
        Não foi possível carregar o agendamento agora.
      </p>
    );
  }

  return (
    <div className="mb-6 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
      {activeCall && !showPicker && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-card-foreground">
            Call agendada para {formatCallDateHeader(activeCall.scheduledAt, timeZone, { withYear: true })} às{" "}
            {formatTZTime(activeCall.scheduledAt, timeZone)}
          </p>
          <button
            onClick={() => setShowPicker(true)}
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90"
          >
            Remarcar Call
          </button>
        </div>
      )}
      {!activeCall && !showPicker && (
        <button
          onClick={() => setShowPicker(true)}
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90"
        >
          Agendar Call
        </button>
      )}
      {showPicker && (
        <div>
          <p className="mb-3 text-sm font-semibold text-card-foreground">Escolha um horário:</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {freeSlots.slice(0, 20).map((slot) => (
              <button
                key={slot}
                disabled={scheduling}
                onClick={() => schedule(slot)}
                className="rounded-md border border-border px-3 py-2 text-xs text-card-foreground hover:bg-brand-primary/10 disabled:opacity-50"
              >
                {formatCallDateHeader(slot, timeZone, { withYear: false })} {formatTZTime(slot, timeZone)}
              </button>
            ))}
          </div>
          {freeSlots.length === 0 && <p className="text-xs text-muted-foreground">Nenhum horário livre nos próximos dias.</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Modificar `src/components/AtasPageClient.tsx`**

```tsx
// src/components/AtasPageClient.tsx
"use client";

import { useEffect, useState } from "react";
import type { CallNote } from "@/lib/callNotes";
import { AtasList } from "./AtasList";
import { CallScheduler } from "./CallScheduler";

export function AtasPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [notes, setNotes] = useState<CallNote[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNotes(null);
    setError(false);
    fetch(`/api/atas/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { notes: CallNote[] };
      })
      .then((data) => {
        if (!cancelled) setNotes(data.notes);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Atas</h1>
      <CallScheduler clientId={clientId} accessKey={accessKey} />
      {error && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Não foi possível carregar as atas agora.
        </p>
      )}
      {!error && !notes && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!error && notes && <AtasList notes={notes} clientId={clientId} accessKey={accessKey} />}
    </div>
  );
}
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Verificação manual no navegador**

Abrir `http://localhost:3000/debora/atas?key=<token_real>`, clicar "Agendar Call", escolher um horário, confirmar que aparece "Call agendada para..." e que o evento surge no Google Calendar real. Clicar "Remarcar Call" e confirmar que o evento antigo some do calendário e um novo aparece.

- [ ] **Step 5: Commit**

```bash
git add src/components/CallScheduler.tsx src/components/AtasPageClient.tsx
git commit -m "feat: agendamento de call na página Atas"
```

---

### Task 5: Migration `call_notes.tasks_extracted_at` + `createTask` no ClickUp + `src/lib/taskExtraction.ts`

**Files:**
- Create: `supabase/migrations/0014_call_notes_processed.sql`
- Modify: `src/lib/clickup.ts`
- Create: `src/lib/taskExtraction.ts`
- Modify: `src/lib/callNotes.ts`

**Interfaces:**
- Consumes: `process.env.CLICKUP_API_TOKEN` (já existe); `process.env.ANTHROPIC_API_KEY` (nova).
- Produces: `createTask(listId: string, title: string, description: string): Promise<void>` adicionada em `src/lib/clickup.ts`; `extractTasksFromNote(content: string): Promise<{ title: string; description: string }[]>` em `src/lib/taskExtraction.ts`; `markTasksExtracted(clientId: string, noteId: string): Promise<void>` adicionada em `src/lib/callNotes.ts`.

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0014_call_notes_processed.sql
alter table call_notes add column if not exists tasks_extracted_at timestamptz;
```

O Victor roda essa migration no SQL Editor do Supabase antes do próximo passo.

- [ ] **Step 2: Adicionar `createTask` em `src/lib/clickup.ts`**

Adicionar ao final do arquivo:

```ts
export async function createTask(listId: string, title: string, description: string): Promise<void> {
  const res = await fetch(`${CLICKUP_API}/list/${listId}/task`, {
    method: "POST",
    headers: { Authorization: process.env.CLICKUP_API_TOKEN!, "Content-Type": "application/json" },
    body: JSON.stringify({ name: title, description }),
  });
  const json = await res.json();
  if (!res.ok || json.err) throw new Error(json.err ?? `clickup_create_task_failed: ${res.status}`);
}
```

- [ ] **Step 3: Criar `src/lib/taskExtraction.ts`**

```ts
// src/lib/taskExtraction.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a chave da Anthropic).
const EXTRACT_TOOL = {
  name: "extract_tasks",
  description: "Registra os itens de ação (tasks) identificados no texto de uma ata de reunião.",
  input_schema: {
    type: "object" as const,
    properties: {
      tasks: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            title: { type: "string" as const, description: "Título curto da task, no imperativo." },
            description: { type: "string" as const, description: "Detalhe da task, 1-2 frases." },
          },
          required: ["title", "description"],
        },
      },
    },
    required: ["tasks"],
  },
};

export async function extractTasksFromNote(content: string): Promise<{ title: string; description: string }[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_tasks" },
      messages: [
        {
          role: "user",
          content: `Leia esta ata de reunião e extraia os itens de ação (tarefas a fazer) mencionados. Se não houver nenhum, retorne uma lista vazia.\n\n${content}`,
        },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`anthropic_failed: ${JSON.stringify(json)}`);

  const toolUse = json.content?.find((block: { type: string }) => block.type === "tool_use");
  if (!toolUse) return [];
  return (toolUse.input.tasks ?? []) as { title: string; description: string }[];
}
```

- [ ] **Step 4: Adicionar `markTasksExtracted` em `src/lib/callNotes.ts`**

Adicionar ao final do arquivo:

```ts
export async function markTasksExtracted(clientId: string, noteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("call_notes")
    .update({ tasks_extracted_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("id", noteId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 5: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0014_call_notes_processed.sql src/lib/clickup.ts src/lib/taskExtraction.ts src/lib/callNotes.ts
git commit -m "feat: createTask no ClickUp + extração de tasks via Anthropic"
```

---

### Task 6: Rota `POST /api/atas/[client]/[id]/extract-tasks`

**Files:**
- Create: `src/app/api/atas/[client]/[id]/extract-tasks/route.ts`

**Interfaces:**
- Consumes: `verifyClientToken`, `CLIENTS`, `fetchCallNote`/`markTasksExtracted` de `src/lib/callNotes.ts`, `extractTasksFromNote` de `src/lib/taskExtraction.ts`, `createTask` de `src/lib/clickup.ts`.
- Produces: `POST` retorna `{ created: number }`.

- [ ] **Step 1: Criar a rota**

```ts
// src/app/api/atas/[client]/[id]/extract-tasks/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientToken } from "@/lib/access";
import { fetchCallNote, markTasksExtracted } from "@/lib/callNotes";
import { extractTasksFromNote } from "@/lib/taskExtraction";
import { createTask } from "@/lib/clickup";

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string; id: string }> }) {
  const { client: clientId, id: noteId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!client.clickupListId) return Response.json({ error: "no_clickup_list" }, { status: 400 });

  try {
    const note = await fetchCallNote(clientId, noteId);
    if (!note) return Response.json({ error: "not_found" }, { status: 404 });

    const tasks = await extractTasksFromNote(note.content);
    for (const task of tasks) {
      await createTask(client.clickupListId, task.title, task.description);
    }
    await markTasksExtracted(clientId, noteId);

    return Response.json({ created: tasks.length });
  } catch (err) {
    console.error(`[atas/extract-tasks] falha ao extrair tasks da ata ${noteId} de ${clientId}:`, err);
    return Response.json({ error: "extract_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Verificação manual**

Com `ANTHROPIC_API_KEY` configurada e `npm run dev` rodando:

```bash
curl -s -X POST "http://localhost:3000/api/atas/debora/<id_de_uma_ata_real>/extract-tasks?key=<token_real>" | python3 -m json.tool
```

Expected: `{ "created": N }` com N ≥ 0. Conferir no ClickUp (lista da Débora) que as tasks apareceram.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/atas/\[client\]/\[id\]/extract-tasks/
git commit -m "feat: rota POST /api/atas/[client]/[id]/extract-tasks"
```

---

### Task 7: Botão "Extrair tasks" na página de detalhe da ata

**Files:**
- Modify: `src/components/AtaDetailPageClient.tsx`

**Interfaces:**
- Consumes: `POST /api/atas/[client]/[id]/extract-tasks` (Task 6).

- [ ] **Step 1: Modificar `src/components/AtaDetailPageClient.tsx`**

Adicionar estado e botão. Trecho completo do componente após a mudança:

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
type ExtractStatus = "idle" | "extracting" | "done" | "error";

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
  const [extractStatus, setExtractStatus] = useState<ExtractStatus>("idle");
  const [createdCount, setCreatedCount] = useState(0);

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

  function extractTasks() {
    setExtractStatus("extracting");
    fetch(`/api/atas/${clientId}/${noteId}/extract-tasks?key=${encodeURIComponent(accessKey)}`, { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { created: number };
      })
      .then((data) => {
        setCreatedCount(data.created);
        setExtractStatus("done");
      })
      .catch(() => setExtractStatus("error"));
  }

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
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{note.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCallDateHeader(note.callAt, timeZone, { withYear: true })} · {formatTZTime(note.callAt, timeZone)}
              </p>
            </div>
            <button
              onClick={extractTasks}
              disabled={extractStatus === "extracting"}
              className="shrink-0 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {extractStatus === "extracting" ? "Extraindo..." : extractStatus === "done" ? `Tasks criadas (${createdCount})` : "Extrair tasks"}
            </button>
          </div>
          {extractStatus === "error" && (
            <p className="mb-4 text-xs text-red-500">Não foi possível extrair as tasks, tenta de novo.</p>
          )}
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

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Verificação manual no navegador**

Abrir uma ata em `http://localhost:3000/debora/atas/<id>?key=<token_real>`, clicar "Extrair tasks", confirmar que o botão vira "Tasks criadas (N)" e que as tasks aparecem no ClickUp e na página Tasks do dashboard.

- [ ] **Step 4: Rodar `npm run build` (checagem final de todo o plano)**

Run: `npm run build`
Expected: build limpo, sem erros de tipo ou de rota.

- [ ] **Step 5: Commit**

```bash
git add src/components/AtaDetailPageClient.tsx
git commit -m "feat: botão Extrair tasks na página de detalhe da ata"
```
