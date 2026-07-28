# Redesign da página Atas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a página Atas: lista agrupada por dia com cabeçalho de data fora da caixa, ícone de documento, horário à direita, e clique abrindo uma página de detalhe nova com o conteúdo renderizado em Markdown.

**Architecture:** A coluna `call_notes.call_date` (só data) vira `call_notes.call_at` (timestamptz, data+hora). `src/lib/callNotes.ts` ganha `fetchCallNote` (busca individual) e passa a expor `callAt` em ms. Um novo `src/lib/formatCallDate.ts` centraliza a formatação de cabeçalho de data (fuso NY, reaproveitando `nyTime.ts`), compartilhado entre a lista e o detalhe. Uma rota nova (`GET /api/atas/[client]/[id]`) e uma página nova (`/[client]/atas/[id]`) servem o detalhe, renderizado com `react-markdown`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Supabase (`@supabase/supabase-js`), `react-markdown` (dependência nova).

## Global Constraints

- Aba "Transcrição" fora de escopo nesta rodada (depende de plano pago da Granola) — a página de detalhe mostra só o conteúdo da nota, sem tabs.
- Todo horário exibido usa o fuso `America/New_York`, via `src/lib/nyTime.ts` (já existente) — nunca o fuso do navegador de quem acessa.
- `react-markdown` é a única dependência nova — sem `@tailwindcss/typography`; a formatação vem de componentes customizados passados pra `<ReactMarkdown components={...}>`, estilizados com as classes Tailwind já usadas no resto do projeto.
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, dados reais/teste via curl, e checagem visual no Browser pane.
- A única linha real da tabela hoje (ata da Laís, `id = "43a2ddab-ee55-4c8c-8e8a-c7af67e7f9d9"`) precisa ter seu `call_at` corrigido pro horário real da call (`2026-07-09T15:00:00Z`, = 11:00 EDT) depois da migration — isso é uma correção permanente de dado real, não um dado de teste a remover.
- Não mesclar em `main`/`staging` sem aprovação explícita do Victor.

## Handoff obrigatório antes da Task 1

Este plano cria uma migration nova (`supabase/migrations/0005_call_notes_call_at.sql`) que renomeia e muda o tipo de uma coluna existente. O ambiente deste agente não tem acesso de aplicar migrations (só `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, sem Supabase CLI linkado). Antes de prosseguir na Task 1:

1. O implementador da Task 1 deve criar o arquivo da migration, PARAR e avisar o controller/Victor, pedindo pra rodar o SQL no SQL Editor do Supabase (mesmo fluxo das migrations `0001`-`0004`).
2. Só depois da confirmação, o implementador continua pro resto da Task 1 (correção do dado real da Laís + verificação).

---

### Task 1: Migration `call_at` + `callNotes.ts` + `formatCallDate.ts`

**Files:**
- Create: `supabase/migrations/0005_call_notes_call_at.sql`
- Modify: `src/lib/callNotes.ts` (arquivo inteiro será substituído)
- Create: `src/lib/formatCallDate.ts`

**Interfaces:**
- Consumes: `getNYDateParts(ms)` de `src/lib/nyTime.ts` (já existente).
- Produces: `CallNote = { id: string; title: string; callAt: number; content: string }`, `fetchCallNotes(clientId): Promise<CallNote[]>`, `fetchCallNote(clientId, id): Promise<CallNote | null>` (de `callNotes.ts`); `formatCallDateHeader(callAt: number, options?: { withYear?: boolean }): string` (de `formatCallDate.ts`) — todos consumidos pelas Tasks 2, 3 e 4.

- [ ] **Step 1: Criar a migration `supabase/migrations/0005_call_notes_call_at.sql`**

```sql
alter table call_notes rename column call_date to call_at;
alter table call_notes alter column call_at type timestamptz using call_at::timestamptz;
```

- [ ] **Step 2: PARAR e pedir handoff**

Avise o controller/Victor: "Criei a migration `0005_call_notes_call_at.sql`. Preciso que você rode esse SQL no SQL Editor do Supabase antes de eu continuar." Espere a confirmação antes de prosseguir.

- [ ] **Step 3: Substituir `src/lib/callNotes.ts` inteiro**

```ts
// src/lib/callNotes.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export type CallNote = { id: string; title: string; callAt: number; content: string };

export async function fetchCallNotes(clientId: string): Promise<CallNote[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("call_notes")
    .select("id, title, call_at, content")
    .eq("client_id", clientId)
    .order("call_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    callAt: Date.parse(row.call_at),
    content: row.content,
  }));
}

export async function fetchCallNote(clientId: string, id: string): Promise<CallNote | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("call_notes")
    .select("id, title, call_at, content")
    .eq("client_id", clientId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: data.id, title: data.title, callAt: Date.parse(data.call_at), content: data.content };
}
```

- [ ] **Step 4: Criar `src/lib/formatCallDate.ts`**

```ts
// src/lib/formatCallDate.ts
import { getNYDateParts } from "./nyTime";

const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// ponytail: weekday calculado a partir de year/month/day puros (componentes de calendário,
// não um instante) — mesmo padrão já usado em CalendarMonthView/CalendarWeekView.
export function formatCallDateHeader(callAt: number, options?: { withYear?: boolean }): string {
  const { year, month, day } = getNYDateParts(callAt);
  const weekday = new Date(year, month, day).getDay();
  const base = `${WEEKDAY_LABELS[weekday]}., ${day} de ${MONTH_LABELS[month]}.`;
  return options?.withYear ? `${base} de ${year}` : base;
}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Corrigir o dado real da Laís (permanente, não é dado de teste)**

```bash
set -a && source .env.local && set +a
curl -s -X PATCH "$SUPABASE_URL/rest/v1/call_notes?id=eq.43a2ddab-ee55-4c8c-8e8a-c7af67e7f9d9" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"call_at": "2026-07-09T15:00:00Z"}'
```

Expected: retorna a linha atualizada com `"call_at":"2026-07-09T15:00:00+00:00"` (ou equivalente).

- [ ] **Step 7: Verificação real com script Node isolado + dados de teste (inseridos e removidos pelos IDs retornados)**

```bash
set -a && source .env.local && set +a
INSERT_RESULT=$(curl -s -X POST "$SUPABASE_URL/rest/v1/call_notes" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '[{"client_id": "tiago", "title": "Teste Task 1", "call_at": "2026-07-20T18:30:00Z", "content": "conteúdo de teste"}]')
echo "$INSERT_RESULT"
TEST_ID=$(echo "$INSERT_RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].id))")
echo "TEST_ID=$TEST_ID"

node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
(async () => {
  const { data, error } = await supabase.from('call_notes').select('id, title, call_at, content').eq('client_id', 'tiago').order('call_at', { ascending: false });
  if (error) { console.error('FAIL', error.message); process.exit(1); }
  if (data.length !== 1 || new Date(data[0].call_at).getTime() !== Date.parse('2026-07-20T18:30:00Z')) {
    console.error('FAIL: dado ou callAt não bate'); process.exit(1);
  }
  console.log('OK: fetchCallNotes-equivalent retorna o registro certo com callAt correto');
})();
"

curl -s -X DELETE "$SUPABASE_URL/rest/v1/call_notes?id=eq.$TEST_ID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `OK: fetchCallNotes-equivalent retorna o registro certo com callAt correto`, e a linha de teste é apagada pelo ID exato (nunca por `client_id` — ver lição registrada de rodadas anteriores).

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: build limpo (os arquivos ainda não são consumidos por rotas que mudaram de shape, exceto onde o build já falharia se os tipos não baterem).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0005_call_notes_call_at.sql src/lib/callNotes.ts src/lib/formatCallDate.ts
git commit -m "Migra call_notes.call_date pra call_at (timestamptz) + adiciona fetchCallNote e formatCallDateHeader"
```

---

### Task 2: Rota `GET /api/atas/[client]/[id]`

**Files:**
- Create: `src/app/api/atas/[client]/[id]/route.ts`

**Interfaces:**
- Consumes: `fetchCallNote(clientId, id)` de `src/lib/callNotes.ts` (Task 1).
- Produces: `GET /api/atas/[client]/[id]?key=TOKEN` → `{ note: CallNote }` em sucesso, `404` se não existir — consumido pela Task 4.

- [ ] **Step 1: Criar `src/app/api/atas/[client]/[id]/route.ts`**

```ts
// src/app/api/atas/[client]/[id]/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchCallNote } from "@/lib/callNotes";
import { verifyClientToken } from "@/lib/access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string; id: string }> }) {
  const { client: clientId, id } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const note = await fetchCallNote(clientId, id);
    if (!note) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ note });
  } catch (err) {
    console.error(`[atas] falha ao buscar ata ${id} de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpo, `ƒ /api/atas/[client]/[id]` presente na lista de rotas.

- [ ] **Step 4: Verificação real ao vivo — 404/401/200**

Com o dev server rodando (`.claude/launch.json`, config `dashboard-cliqueboost`, porta 3001):

```bash
# 404: cliente inexistente
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/atas/naoexiste/43a2ddab-ee55-4c8c-8e8a-c7af67e7f9d9?key=qualquer"
# esperado: 404

# 401: cliente real, token errado
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/atas/lais/43a2ddab-ee55-4c8c-8e8a-c7af67e7f9d9?key=chaveerrada"
# esperado: 401

# 404: cliente real, token certo, id inexistente
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/atas/lais/00000000-0000-0000-0000-000000000000?key=ecfc91088af28b32fb48d1dbcc46f626"
# esperado: 404

# 200: cliente real (lais), token certo, id real
curl -s "http://localhost:3001/api/atas/lais/43a2ddab-ee55-4c8c-8e8a-c7af67e7f9d9?key=ecfc91088af28b32fb48d1dbcc46f626"
# esperado: {"note":{"id":"43a2ddab-...","title":"Estratégia de conteúdo e métricas do Instagram","callAt":1783695600000,"content":"..."}}
```

Expected: os 4 códigos batem exatamente, e o `GET` de sucesso retorna a ata real da Laís com `callAt` numérico (timestamp em ms de `2026-07-09T15:00:00Z`).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/atas/[client]/[id]/route.ts"
git commit -m "Adiciona rota GET /api/atas/[client]/[id]"
```

---

### Task 3: Redesenho de `AtasList.tsx` (agrupamento por dia + links)

**Files:**
- Modify: `src/components/AtasList.tsx` (arquivo inteiro será substituído)
- Modify: `src/components/AtasPageClient.tsx`

**Interfaces:**
- Consumes: `CallNote` de `src/lib/callNotes.ts` (Task 1), `formatCallDateHeader` de `src/lib/formatCallDate.ts` (Task 1), `getNYDateParts`/`formatNYTime` de `src/lib/nyTime.ts` (já existente).
- Produces: `AtasList({ notes, clientId, accessKey }: { notes: CallNote[]; clientId: string; accessKey: string })` — nova assinatura (ganhou `clientId`/`accessKey`), consumida por `AtasPageClient.tsx`.

- [ ] **Step 1: Substituir `src/components/AtasList.tsx` inteiro**

```tsx
// src/components/AtasList.tsx
"use client";

import Link from "next/link";
import type { CallNote } from "@/lib/callNotes";
import { formatCallDateHeader } from "@/lib/formatCallDate";
import { getNYDateParts, formatNYTime } from "@/lib/nyTime";

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
// consecutivas do mesmo dia-calendário em NY, sem reordenar nada.
function groupByDay(notes: CallNote[]): DateGroup[] {
  const groups: DateGroup[] = [];
  let lastKey: string | null = null;

  for (const note of notes) {
    const parts = getNYDateParts(note.callAt);
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    if (key !== lastKey) {
      groups.push({ headerLabel: formatCallDateHeader(note.callAt), notes: [note] });
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
  if (notes.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma ata registrada ainda.</p>
      </div>
    );
  }

  const groups = groupByDay(notes);

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
                <span className="shrink-0 text-xs text-muted-foreground">{formatNYTime(note.callAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Modificar `src/components/AtasPageClient.tsx` — passar `clientId`/`accessKey` pro `AtasList`**

Troque a linha:

```tsx
{!error && notes && <AtasList notes={notes} />}
```

por:

```tsx
{!error && notes && <AtasList notes={notes} clientId={clientId} accessKey={accessKey} />}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 5: Checagem visual**

Abrir `/lais/atas?key=ecfc91088af28b32fb48d1dbcc46f626`. Confirmar:
- Cabeçalho de data fora da caixa, formato `"qui., 9 de jul."` (9 de julho de 2026 é uma quinta-feira).
- Ícone de documento à esquerda da nota, título no meio, horário `11:00` à direita (fuso NY, já que o `call_at` real da Laís foi corrigido pra `2026-07-09T15:00:00Z` = 11:00 EDT na Task 1).
- Clicar na nota navega pra `/lais/atas/43a2ddab-ee55-4c8c-8e8a-c7af67e7f9d9?key=...` (a página de detalhe ainda não existe até a Task 4 — é esperado dar 404 do Next.js aqui, não é bug desta task).
- `read_console_messages` sem erros relacionados a esta mudança.

- [ ] **Step 6: Commit**

```bash
git add src/components/AtasList.tsx src/components/AtasPageClient.tsx
git commit -m "Redesenha AtasList: agrupamento por dia, ícone, horário, navegação por Link"
```

---

### Task 4: Página de detalhe da ata (Markdown)

**Files:**
- Create: `src/app/[client]/atas/[id]/page.tsx`
- Create: `src/components/AtaDetailPageClient.tsx`
- Modify: `package.json` (via `npm install react-markdown`)

**Interfaces:**
- Consumes: rota `GET /api/atas/[client]/[id]` (Task 2), `CallNote` de `src/lib/callNotes.ts` (Task 1), `formatCallDateHeader` de `src/lib/formatCallDate.ts` (Task 1), `formatNYTime` de `src/lib/nyTime.ts`.

- [ ] **Step 1: Instalar a dependência**

```bash
npm install react-markdown
```

- [ ] **Step 2: Criar `src/app/[client]/atas/[id]/page.tsx`**

```tsx
// src/app/[client]/atas/[id]/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { AtaDetailPageClient } from "@/components/AtaDetailPageClient";
import { verifyClientToken } from "@/lib/access";

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

  return (
    <div className="flex min-h-full">
      <Sidebar clientId={found.id} accessKey={key!} active="atas" />
      <div className="min-w-0 flex-1">
        <AtaDetailPageClient clientId={found.id} accessKey={key!} noteId={id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `src/components/AtaDetailPageClient.tsx`**

```tsx
// src/components/AtaDetailPageClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { CallNote } from "@/lib/callNotes";
import { formatCallDateHeader } from "@/lib/formatCallDate";
import { formatNYTime } from "@/lib/nyTime";

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
            {formatCallDateHeader(note.callAt, { withYear: true })} · {formatNYTime(note.callAt)}
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

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build limpo, `ƒ /[client]/atas/[id]` presente na lista de rotas.

- [ ] **Step 6: Checagem visual completa**

Abrir `/lais/atas?key=ecfc91088af28b32fb48d1dbcc46f626`, clicar na ata "Estratégia de conteúdo e métricas do Instagram". Confirmar:
- Navega pra `/lais/atas/43a2ddab-ee55-4c8c-8e8a-c7af67e7f9d9?key=...`.
- Cabeçalho mostra título + `"qui., 9 de jul. de 2026 · 11:00"`.
- Conteúdo (que foi salvo como texto simples com bullets "-", sem cabeçalhos "#") aparece com os bullets formatados como lista de verdade (`<ul><li>`), mesmo sem títulos em negrito (já que o texto original não tem sintaxe de cabeçalho Markdown — isso é esperado, não é bug).
- Link "← Voltar" retorna pra `/lais/atas?key=...`.
- Testar também um id inexistente (`/lais/atas/00000000-0000-0000-0000-000000000000?key=...`) — deve mostrar "Ata não encontrada.", sem quebrar.
- `read_console_messages` sem erros.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[client]/atas/[id]/page.tsx" src/components/AtaDetailPageClient.tsx package.json package-lock.json
git commit -m "Adiciona página de detalhe da ata com conteúdo renderizado em Markdown"
```
