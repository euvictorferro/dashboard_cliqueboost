# Login de Cliente (email/senha) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente entra no dashboard com email/senha (Supabase Auth) em vez de link com `?key=<token>` na URL. Sessão via cookie httpOnly assinado pelo próprio servidor. Login continua single-tenant (1 conta = 1 cliente), contas criadas manualmente por vocês.

**Architecture:** `supabase.auth.signInWithPassword` valida a senha (usa a Anon Key, não a Service Role); depois disso o servidor assina seu próprio cookie de sessão (JWT simples HS256 via `node:crypto`, sem lib nova) contendo `{ clientId }`. Um `middleware.ts` novo protege todas as rotas de cliente/API lendo esse cookie. Toda a base de código (~9 páginas, ~37 rotas de API, ~29 componentes client-side) troca `verifyClientToken(clientId, key)` por `verifyClientSession(clientId)` e para de propagar `accessKey`/`?key=` manualmente — o cookie httpOnly já viaja sozinho em toda requisição same-origin.

**Tech Stack:** Next.js 16 App Router (middleware roda em Node.js runtime, não precisa de config especial), TypeScript, `@supabase/supabase-js` (já instalado, usado também como client anônimo agora), `node:crypto` pra assinar o cookie — sem dependências novas.

## Global Constraints

- Substitui completamente o sistema de `?key=` — links antigos param de funcionar, sem período de convivência.
- 1 conta de login = 1 cliente (não é por pessoa). Contas criadas manualmente por vocês (Supabase Dashboard), sem self-signup público.
- Sem "esqueci minha senha" nesta v1 — reset é manual (trocar senha direto no Supabase Dashboard).
- Sessão é um JWT **próprio** (não a sessão oficial do Supabase Auth via `@supabase/ssr`) — o app usa Service Role Key pra tudo, RLS por usuário não é usado em lugar nenhum, então a sessão completa do Supabase não compra nada extra aqui.
- Erro de login (senha errada, sem conta) sempre mostra a mesma mensagem genérica "Email ou senha inválidos" — nunca revela qual etapa falhou.
- Env vars novas: `SESSION_SECRET` (string aleatória, assina o cookie), `SUPABASE_ANON_KEY` (client anônimo pro `signInWithPassword` — hoje o projeto só tem a Service Role Key).
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, e checagem ao vivo com o dev server.

---

### Task 1: Migration `client_accounts` + env vars

**Files:**
- Create: `supabase/migrations/0020_client_accounts.sql`
- Modify: `.env.example`

**Interfaces:**
- Produces: tabela `client_accounts (user_id uuid, client_id text)`, usada pela Task 4 (login) e indiretamente por `verifyClientSession` (Task 3) via o payload já resolvido no cookie — a tabela só é lida no momento do login, não a cada requisição.

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0020_client_accounts.sql
create table if not exists client_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id text not null unique,
  created_at timestamptz not null default now()
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela —
-- mesmo padrão de bug_reports/referral_leads/client_ratings.
alter table client_accounts enable row level security;
```

- [ ] **Step 2: Rodar a migration no Supabase**

Cole o SQL acima no SQL Editor do Supabase (projeto de produção) e execute. Confirme que a tabela aparece em Table Editor.

- [ ] **Step 3: Adicionar as env vars novas no `.env.example`**

```
# Supabase (projeto novo, dedicado a este dashboard)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Login de cliente (sessão própria, cookie assinado)
SESSION_SECRET=
```

- [ ] **Step 4: Gerar e configurar `SESSION_SECRET`**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

Adiciona o valor gerado como `SESSION_SECRET` no `.env.local` e, depois, na Vercel (Preview desta branch e Production quando for a hora). Adiciona também `SUPABASE_ANON_KEY` (pegue em Supabase Dashboard → Settings → API → `anon` `public` key) nos dois lugares.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0020_client_accounts.sql .env.example
git commit -m "feat(login): migration client_accounts + env vars de sessão"
```

---

### Task 2: `src/lib/session.ts` — assinar/verificar cookie de sessão

**Files:**
- Create: `src/lib/session.ts`

**Interfaces:**
- Consumes: `SESSION_SECRET` (env var).
- Produces: `signSession(clientId: string): string` (retorna o valor do cookie), `verifySession(cookieValue: string | undefined): { clientId: string } | null` — usadas pelas Tasks 3, 4 e 6 (middleware).

- [ ] **Step 1: Criar `src/lib/session.ts`**

```ts
// src/lib/session.ts
// ponytail: sessão própria (JWT HS256 caseiro via node:crypto), não a sessão do Supabase Auth —
// o app usa Service Role Key pra tudo, RLS por usuário não é usado em lugar nenhum, então a
// sessão completa do Supabase Auth (com refresh token, sync entre middleware/server/route
// handler via @supabase/ssr) não compra nada aqui. Upgrade se algum dia precisar de RLS de
// verdade por usuário: trocar por @supabase/ssr.
import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 dias

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurada");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSession(clientId: string): string {
  const payload = JSON.stringify({ clientId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS });
  const encodedPayload = base64url(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySession(cookieValue: string | undefined): { clientId: string } | null {
  if (!cookieValue) return null;
  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) return null;

  let expectedSignature: string;
  try {
    expectedSignature = sign(encodedPayload);
  } catch {
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (typeof payload.clientId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { clientId: payload.clientId };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "session";
export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE_SECONDS;
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/session.ts
git commit -m "feat(login): assinatura e verificação de sessão via cookie (node:crypto)"
```

---

### Task 3: `src/lib/access.ts` — `verifyClientSession`

**Files:**
- Modify: `src/lib/access.ts`

**Interfaces:**
- Consumes: `verifySession`, `SESSION_COOKIE_NAME` de `src/lib/session.ts` (Task 2); `cookies()` de `next/headers`.
- Produces: `verifyClientSession(clientId: string): Promise<boolean>` — substitui `verifyClientToken` em todas as pages/rotas (Tasks 7-8). Mantém `verifyClientToken` por enquanto (removida só na Task 9, depois que nada mais a usar).

- [ ] **Step 1: Adicionar `verifyClientSession` em `src/lib/access.ts`**

```ts
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "./supabase";
import { verifySession, SESSION_COOKIE_NAME } from "./session";

// ponytail: server-only. Sem Supabase configurado, nega acesso por padrão (fail closed).
export async function verifyClientToken(clientId: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { data } = await supabase.from("client_tokens").select("token").eq("client_id", clientId).maybeSingle();
  return Boolean(data && data.token === token);
}

export async function verifyClientSession(clientId: string): Promise<boolean> {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  return session?.clientId === clientId;
}
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/access.ts
git commit -m "feat(login): verifyClientSession lendo cookie httpOnly"
```

---

### Task 4: Rotas `POST /api/auth/login` e `POST /api/auth/logout`

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: `signSession`, `SESSION_COOKIE_NAME`, `SESSION_COOKIE_MAX_AGE` de `src/lib/session.ts` (Task 2); `SUPABASE_ANON_KEY`/`SUPABASE_URL` (env vars); `getSupabaseAdmin` de `src/lib/supabase.ts` (já existe).
- Produces: `POST /api/auth/login` com body `{ email, password }` → `{ clientId }` (200) ou `{ error: "invalid_credentials" }` (401), seta cookie `session`. `POST /api/auth/logout` → `{ ok: true }`, limpa o cookie. Ambas usadas pela Task 5 (página de login) e Task 9 (botão Sair).

- [ ] **Step 1: Criar `src/app/api/auth/login/route.ts`**

```ts
// src/app/api/auth/login/route.ts
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { signSession, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;
  if (typeof email !== "string" || typeof password !== "string") {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error("[auth] SUPABASE_URL/SUPABASE_ANON_KEY não configurados");
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await anon.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return Response.json({ error: "invalid_credentials" }, { status: 401 });

  const { data: account } = await admin
    .from("client_accounts")
    .select("client_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!account) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const response = Response.json({ clientId: account.client_id });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${signSession(account.client_id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
  return response;
}
```

- [ ] **Step 2: Criar `src/app/api/auth/logout/route.ts`**

```ts
// src/app/api/auth/logout/route.ts
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return response;
}
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Criar a primeira conta de teste no Supabase**

No Supabase Dashboard → Authentication → Users → Add user (email + senha à sua escolha, ex: `teste@cliqueboost.io`). Copie o `user_id` gerado, depois rode no SQL Editor:
```sql
insert into client_accounts (user_id, client_id) values ('<user_id copiado>', 'tiago');
```

- [ ] **Step 5: Verificação ao vivo**

Com `npm run dev` rodando:
```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@cliqueboost.io","password":"<senha escolhida>"}'
```
Expected: `200`, corpo `{"clientId":"tiago"}`, header `Set-Cookie: session=...`. Testar senha errada retorna `401 {"error":"invalid_credentials"}`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth
git commit -m "feat(login): rotas de login e logout (Supabase Auth + cookie de sessão)"
```

---

### Task 5: Página `/login`

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/components/LoginForm.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/login` (Task 4); `Logo` de `src/components/Logo.tsx` (já existe).
- Produces: página `/login` renderizada, formulário reaproveitável.

- [ ] **Step 1: Criar `src/components/LoginForm.tsx`**

```tsx
// src/components/LoginForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Email ou senha inválidos.");
        return;
      }
      const { clientId } = await res.json();
      router.push(`/${clientId}`);
    } catch {
      setError("Email ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <input
        type="password"
        required
        placeholder="Senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Criar `src/app/login/page.tsx`**

```tsx
// src/app/login/page.tsx
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center gap-4 px-4 py-16">
      <Logo />
      <h1 className="text-xl font-semibold text-foreground">Entrar</h1>
      <LoginForm />
    </div>
  );
}
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/login src/components/LoginForm.tsx
git commit -m "feat(login): página /login com formulário email/senha"
```

---

### Task 6: `middleware.ts` — proteção de rota

**Files:**
- Create: `middleware.ts` (raiz do projeto, ao lado de `next.config.ts`)

**Interfaces:**
- Consumes: `verifySession`, `SESSION_COOKIE_NAME` de `src/lib/session.ts` (Task 2).
- Produces: intercepta toda requisição, redireciona/bloqueia sem sessão válida.

- [ ] **Step 1: Criar `middleware.ts`**

```ts
// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/sair", "/api/auth/logout"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/" ||
    pathname === "/icon.png"
  ) {
    return NextResponse.next();
  }

  const session = verifySession(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  // rotas com [client] na URL: /tiago/..., /api/.../tiago/... — client_id é sempre o
  // primeiro segmento depois de /api/<recurso>/ ou o primeiro segmento da URL nas páginas.
  const clientIdInPath = pathname.startsWith("/api/")
    ? pathname.split("/")[3] // /api/<recurso>/<clientId>/...
    : pathname.split("/")[1]; // /<clientId>/...

  if (!session || (clientIdInPath && session.clientId !== clientIdInPath)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificação ao vivo**

Com `npm run dev` rodando: `curl -i http://localhost:3000/tiago` sem cookie → `302` redirecionando pra `/login`. `curl -i http://localhost:3000/api/conta/tiago` sem cookie → `401`.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat(login): middleware protege rotas de cliente via cookie de sessão"
```

---

### Task 7: Migrar as 9 páginas de `verifyClientToken`/`key` pra `verifyClientSession`

**Files (todas seguem o mesmo padrão, aplicar a mesma transformação em cada uma):**
- Modify: `src/app/[client]/page.tsx`
- Modify: `src/app/[client]/booster-ai/page.tsx`
- Modify: `src/app/[client]/calendario/page.tsx`
- Modify: `src/app/[client]/tasks/page.tsx`
- Modify: `src/app/[client]/bunker/page.tsx`
- Modify: `src/app/[client]/conteudos/page.tsx`
- Modify: `src/app/[client]/atas/page.tsx`
- Modify: `src/app/[client]/atas/[id]/page.tsx`
- Modify: `src/app/[client]/conta/page.tsx`

**Interfaces:**
- Consumes: `verifyClientSession` de `src/lib/access.ts` (Task 3).
- Produces: nenhum componente client-side abaixo dessas páginas recebe mais `accessKey` como prop (a Task 8 remove o prop dos componentes — pode deixar erro de TS temporário entre as Tasks 7 e 8 se rodar em subagents separados; se estiver executando tudo numa sessão só, faça 7 e 8 juntas antes de rodar o build final).

- [ ] **Step 1: Aplicar a transformação em cada arquivo listado acima**

Exemplo representativo — `src/app/[client]/tasks/page.tsx` **antes**:
```tsx
export default async function ClientTasksPage({
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
    <AppFrame clientId={found.id} accessKey={key!} active="tasks" pageLabel="Tasks">
      <TasksPageClient clientId={found.id} accessKey={key!} />
    </AppFrame>
  );
}
```

**Depois:**
```tsx
export default async function ClientTasksPage({ params }: { params: Promise<{ client: string }> }) {
  const { client } = await params;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientSession(found.id);
  if (!authorized) return <AccessDenied />;

  return (
    <AppFrame clientId={found.id} active="tasks" pageLabel="Tasks">
      <TasksPageClient clientId={found.id} />
    </AppFrame>
  );
}
```

Troque também o import: `import { verifyClientToken } from "@/lib/access";` → `import { verifyClientSession } from "@/lib/access";`.

Aplique exatamente essa mesma transformação (remover `searchParams`/`key` da assinatura, trocar `verifyClientToken(found.id, key)` por `verifyClientSession(found.id)`, remover todo `accessKey={key!}` passado a componentes filhos) em cada um dos outros 8 arquivos listados. Alguns têm props extras além de `clientId`/`accessKey` (ex: `atas/[id]/page.tsx` também recebe `id` de `params`) — mantenha essas props, só remova `key`/`accessKey`.

- [ ] **Step 2: Verificar que nenhuma página ainda usa o padrão antigo**

Run: `grep -rn "verifyClientToken\|searchParams: Promise<{ key" "src/app/[client]"`
Expected: nenhum resultado.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[client]"
git commit -m "refactor(login): páginas usam verifyClientSession, param key removido"
```

---

### Task 8: Migrar as 37 rotas de API + os 29 componentes client-side

**Files — rotas de API (mesmo padrão em todas):**
- `src/app/api/atas/[client]/[id]/extract-tasks/route.ts`
- `src/app/api/atas/[client]/[id]/route.ts`
- `src/app/api/atas/[client]/call/route.ts`
- `src/app/api/atas/[client]/route.ts`
- `src/app/api/audience/[client]/route.ts`
- `src/app/api/booster-ai/[client]/chat/route.ts`
- `src/app/api/booster-ai/[client]/messages/route.ts`
- `src/app/api/bug-reports/[client]/route.ts`
- `src/app/api/conta/[client]/email/route.ts`
- `src/app/api/conta/[client]/logo/route.ts`
- `src/app/api/conta/[client]/route.ts`
- `src/app/api/content/[client]/board-meta/route.ts`
- `src/app/api/content/[client]/card/[cardId]/activity/route.ts`
- `src/app/api/content/[client]/card/[cardId]/attachments/route.ts`
- `src/app/api/content/[client]/card/[cardId]/attachments/upload/route.ts`
- `src/app/api/content/[client]/card/[cardId]/checklist/items/route.ts`
- `src/app/api/content/[client]/card/[cardId]/checklist/toggle/route.ts`
- `src/app/api/content/[client]/card/[cardId]/description/route.ts`
- `src/app/api/content/[client]/card/[cardId]/labels/route.ts`
- `src/app/api/content/[client]/card/[cardId]/members/route.ts`
- `src/app/api/content/[client]/card/[cardId]/videos/[fileId]/route.ts`
- `src/app/api/content/[client]/card/[cardId]/videos/init/route.ts`
- `src/app/api/content/[client]/card/[cardId]/videos/match-takes/route.ts`
- `src/app/api/content/[client]/card/[cardId]/videos/route.ts`
- `src/app/api/content/[client]/competitors/[competitorId]/feed/route.ts`
- `src/app/api/content/[client]/competitors/[competitorId]/profile/route.ts`
- `src/app/api/content/[client]/competitors/[competitorId]/route.ts`
- `src/app/api/content/[client]/competitors/route.ts`
- `src/app/api/content/[client]/cover-proxy/route.ts`
- `src/app/api/content/[client]/list/[listId]/cards/route.ts`
- `src/app/api/content/[client]/route.ts`
- `src/app/api/organic/[client]/route.ts`
- `src/app/api/ratings/[client]/route.ts`
- `src/app/api/report/[client]/route.ts`
- `src/app/api/tasks/[client]/list-meta/route.ts`
- `src/app/api/tasks/[client]/route.ts`
- `src/app/api/tasks/[client]/task/[taskId]/assignees/route.ts`
- `src/app/api/tasks/[client]/task/[taskId]/comments/route.ts`
- `src/app/api/tasks/[client]/task/[taskId]/description/route.ts`
- `src/app/api/tasks/[client]/task/[taskId]/due-date/route.ts`
- `src/app/api/tasks/[client]/task/[taskId]/status/route.ts`

**Files — componentes client-side (removem o prop `accessKey` e o `?key=${accessKey}` das URLs de fetch):**
- `src/components/AccountCard.tsx`, `AddCompetitorModal.tsx`, `AppFrame.tsx`, `AtaDetailPageClient.tsx`, `AtasList.tsx`, `AtasPageClient.tsx`, `AudiencePanel.tsx`, `BoosterAiPageClient.tsx`, `BugReportModal.tsx`, `BunkerPageClient.tsx`, `CalendarPageClient.tsx`, `CalendarView.tsx`, `CallScheduler.tsx`, `CmdK.tsx`, `CompetitorProfileModal.tsx`, `CompetitorsSection.tsx`, `ContaPageClient.tsx`, `ContentBoard.tsx`, `ContentCard.tsx`, `ContentCardModal.tsx`, `ContentCardVideoField.tsx`, `ContentPageClient.tsx`, `Dashboard.tsx`, `ExportPdfButton.tsx`, `IdeasList.tsx`, `RatingPopup.tsx`, `Sidebar.tsx`, `TaskDetailModal.tsx`, `TasksPageClient.tsx`, `TasksTable.tsx` (todos em `src/components/`).

**Interfaces:**
- Consumes: `verifyClientSession` de `src/lib/access.ts` (Task 3).
- Produces: nenhuma rota/componente lê mais `key`/`accessKey` de lugar nenhum.

- [ ] **Step 1: Aplicar a transformação em cada rota de API listada**

Exemplo representativo — rota `GET` (mesmo padrão pra `POST`/`DELETE`, só troca o verbo). **Antes:**
```ts
export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  // ... resto da lógica
}
```

**Depois:**
```ts
export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  // ... resto da lógica
}
```

Troque o import `verifyClientToken` → `verifyClientSession` em cada um dos 37 arquivos, removendo a linha `const key = request.nextUrl.searchParams.get("key") ?? undefined;` e trocando a chamada de verificação. Não mexa em mais nada da lógica de cada rota (parâmetros de body, outras query strings que não sejam `key`, etc. continuam como estão).

- [ ] **Step 2: Aplicar a transformação em cada componente client-side listado**

Exemplo representativo — `src/components/AccountCard.tsx`. **Antes:**
```tsx
export function AccountCard({ clientId, accessKey, pageLabel }: { clientId: string; accessKey: string; pageLabel: string }) {
  // ...
  useEffect(() => {
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      // ...
  }, [clientId, accessKey]);
  // ...
  <Link href={`/${clientId}/conta?key=${encodeURIComponent(accessKey)}`}>Ajustes</Link>
}
```

**Depois:**
```tsx
export function AccountCard({ clientId, pageLabel }: { clientId: string; pageLabel: string }) {
  // ...
  useEffect(() => {
    fetch(`/api/conta/${clientId}`)
      .then((res) => res.json())
      // ...
  }, [clientId]);
  // ...
  <Link href={`/${clientId}/conta`}>Ajustes</Link>
}
```

Aplique o mesmo em cada um dos outros 28 componentes: remova `accessKey` da assinatura de props e de todo lugar que a repassa a um componente filho; remova `?key=${encodeURIComponent(accessKey)}` (ou variação equivalente) de toda URL de `fetch`/`Link`/`href`; remova `accessKey` de arrays de dependência de `useEffect`.

- [ ] **Step 3: Verificar que nada mais usa o padrão antigo**

Run: `grep -rln "verifyClientToken\|accessKey\|searchParams.get(\"key\")\|encodeURIComponent(accessKey)" src`
Expected: nenhum resultado (nenhum arquivo listado). Se aparecer algo, é um arquivo esquecido — aplique a mesma transformação nele antes de prosseguir.

- [ ] **Step 4: Rodar `npx tsc --noEmit` e `npm run build`**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros. Erros de TS aqui geralmente significam algum componente que ainda declara `accessKey` como prop obrigatório mas não está mais recebendo — resolva ajustando a assinatura desse componente.

- [ ] **Step 5: Commit**

```bash
git add src/app/api src/components
git commit -m "refactor(login): rotas de API e componentes usam sessão via cookie, sem mais ?key="
```

---

### Task 9: Logout de verdade + limpeza final

**Files:**
- Modify: `src/app/sair/page.tsx`
- Modify: `src/lib/access.ts` (remover `verifyClientToken`)

**Interfaces:**
- Consumes: `POST /api/auth/logout` (Task 4).
- Produces: nenhuma — última task, só limpeza e verificação final.

- [ ] **Step 1: Atualizar `src/app/sair/page.tsx` pra fazer logout de verdade**

```tsx
// src/app/sair/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

export default function SairPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      setTimeout(() => router.push("/login"), 1500);
    });
  }, [router]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Logo />
      <h1 className="text-xl font-semibold text-foreground">Você saiu</h1>
      <p className="text-sm text-muted-foreground">Redirecionando pro login...</p>
    </div>
  );
}
```

- [ ] **Step 2: Remover `verifyClientToken` de `src/lib/access.ts`**

Leia o arquivo primeiro pra confirmar que só `verifyClientSession` ainda é usada em todo o projeto (`grep -rn "verifyClientToken" src` deve já estar vazio pela Task 8). Remova a função `verifyClientToken` inteira, mantendo só `verifyClientSession` e os imports que ela usa.

- [ ] **Step 3: Rodar `npx tsc --noEmit` e `npm run build`**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 4: Verificação ao vivo completa**

Com `npm run dev` rodando:
1. Acesse `http://localhost:3000/tiago` sem estar logado → redireciona pra `/login`.
2. Faça login com a conta de teste criada na Task 4 → redireciona pra `/tiago`, dashboard carrega normalmente (sem `?key=` na URL).
3. Navegue por 2-3 páginas (Tasks, Conteúdos, Conta) → tudo carrega sem erro 401.
4. Tente acessar `http://localhost:3000/lais` logado como `tiago` → bloqueado (redireciona pro login).
5. Clique em "Sair" no menu da conta (`AccountCard`) → volta pro login; tentar acessar `/tiago` de novo pede login.
6. Confirme que um link antigo `?key=<token antigo>` não funciona mais.

- [ ] **Step 5: Commit**

```bash
git add src/app/sair/page.tsx src/lib/access.ts
git commit -m "feat(login): logout de verdade, remove verifyClientToken (código morto)"
```

## Verificação

- `npx tsc --noEmit` e `npm run build` limpos ao final da Task 9.
- Login com credencial válida entra e redireciona certo; senha errada mostra erro genérico.
- Cliente logado não acessa dados de outro cliente trocando a URL.
- Logout limpa a sessão de verdade.
- Nenhum arquivo do projeto ainda referencia `verifyClientToken`, `accessKey` ou `?key=`.
