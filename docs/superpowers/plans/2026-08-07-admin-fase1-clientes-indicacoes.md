# Admin Panel Fase 1 — Clientes + Indicações: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Área `/admin` (servida por `admin.cliqueboost.io`) com auth própria, CRUD de clientes (mata `clients.ts` hardcoded + SQL manual), gestão de indicações e faturamento consolidado.

**Architecture:** Mesmo repo/deploy do dashboard. Proxy detecta host `admin.*` e roteia pra árvore `/admin`, protegida por cookie `admin_session` (mesmo mecanismo HMAC de `lib/session.ts`, secret e cookie distintos). Clientes saem do array hardcoded pra tabela `clients` no Supabase, mantendo a interface de `lib/clients.ts` intacta (zero mudança nas ~50 rotas que a consomem). Toda tabela nova tem `agency_id`.

**Tech Stack:** Next.js 16 App Router · Supabase (service role, padrão atual) · Tailwind v4 · tokens de design existentes em `globals.css`.

**Spec:** `docs/superpowers/specs/2026-08-07-admin-panel-design.md`

## Global Constraints

- Português em toda UI e mensagens. Acentuação correta.
- Reusar tokens/classes existentes (`bg-card`, `border-border`, `text-muted-foreground`, `--radius-card`, `--shadow-soft`) — o admin deve parecer irmão do dashboard.
- Nenhuma dependência npm nova.
- Não alterar comportamento de nenhuma rota `/api/*` existente do cliente (exceto onde o plano manda explicitamente).
- Todo acesso a dado é server-side via `getSupabaseAdmin()` (padrão atual; RLS/JWT fica pra migração posterior — ver ARCHITECTURE.md).
- Comentários em português; simplificações intencionais marcadas com `// ponytail:`.
- Cada task termina com `npx tsc --noEmit` limpo e `npm run build` passando antes do commit.
- Migrations são só escritas em `supabase/migrations/` — o Victor roda no SQL Editor (não há acesso DDL da máquina). Tasks que dependem de tabela nova devem funcionar em fail-safe (erro claro, não crash) enquanto a migration não rodou.

---

### Task 1: Migrations — agencies, admin_users, clients

**Files:**
- Create: `supabase/migrations/0024_admin_foundation.sql`

**Interfaces:**
- Produces: tabelas `agencies`, `admin_users`, `clients` que as tasks 2-6 consomem.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0024_admin_foundation.sql
-- Fundação do Admin Panel (spec 2026-08-07): multi-tenant desde o dia 1.
create table if not exists agencies (
  id text primary key,          -- slug, ex: 'cliqueboost'
  name text not null,
  created_at timestamptz not null default now()
);
insert into agencies (id, name) values ('cliqueboost', 'Clique Boost')
  on conflict (id) do nothing;

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null references agencies(id),
  user_id uuid not null unique,  -- id do Supabase Auth
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- Substitui o array CLIENTS hardcoded de src/lib/clients.ts.
create table if not exists clients (
  id text primary key,           -- slug da URL, ex: 'tiago'
  agency_id text not null references agencies(id),
  name text not null,
  instagram_business_id text,
  clickup_list_id text,          -- integração legada, morre na fase 2
  trello_board_id text,          -- integração legada, morre na fase 3
  ad_account_id text,
  ads_active boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table agencies enable row level security;
alter table admin_users enable row level security;
alter table clients enable row level security;
```

- [ ] **Step 2: Escrever também o INSERT de seed dos clientes atuais**

No fim do mesmo arquivo, um insert por cliente copiando os valores exatos de `src/lib/clients.ts` (abrir o arquivo e transcrever os 6 clientes com seus ids/nomes/instagramBusinessId/clickupListId/trelloBoardId/adAccountId/adsActive):

```sql
-- Seed: clientes atuais de src/lib/clients.ts (transcrever valores reais do arquivo)
insert into clients (id, agency_id, name, instagram_business_id, clickup_list_id, trello_board_id, ad_account_id, ads_active)
values
  ('<id-1>', 'cliqueboost', '<nome-1>', '<ig-1>', '<clickup-1>', '<trello-1>', null, false)
  -- ... um values por cliente do array
on conflict (id) do nothing;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0024_admin_foundation.sql
git commit -m "feat(admin): migration da fundacao (agencies, admin_users, clients + seed)"
```

---

### Task 2: `lib/clients.ts` lê do banco (interface preservada)

**Files:**
- Modify: `src/lib/clients.ts`

**Interfaces:**
- Consumes: tabela `clients` (Task 1).
- Produces: `getClients(): Promise<Client[]>` e `getClient(id: string): Promise<Client | null>` — mesma shape `Client` já exportada hoje (`{ id, name, instagramBusinessId?, clickupListId?, trelloBoardId?, adAccountId?, adsActive? }`).
- **Compat:** o array `CLIENTS` exportado continua existindo como fallback estático até todas as rotas migrarem (fase posterior). Nesta task, nenhuma rota consumidora muda.

- [ ] **Step 1: Adicionar as funções async com cache de módulo**

Manter o array `CLIENTS` atual intacto e acrescentar:

```ts
import { getSupabaseAdmin } from "./supabase";

// ponytail: cache de módulo com TTL de 60s — clientes mudam raramente; evita uma query
// por request. Invalidação é o TTL, sem pub/sub.
let cache: { clients: Client[]; at: number } | null = null;
const CACHE_TTL_MS = 60_000;

type ClientRow = {
  id: string; name: string; instagram_business_id: string | null;
  clickup_list_id: string | null; trello_board_id: string | null;
  ad_account_id: string | null; ads_active: boolean;
};

export async function getClients(): Promise<Client[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.clients;
  const supabase = getSupabaseAdmin();
  if (!supabase) return CLIENTS; // fail-safe: sem env, comporta como antes
  const { data, error } = await supabase
    .from("clients").select("*").eq("active", true).order("name");
  if (error || !data || data.length === 0) return CLIENTS; // fail-safe: migration não rodou
  const clients = (data as ClientRow[]).map((r) => ({
    id: r.id, name: r.name,
    instagramBusinessId: r.instagram_business_id ?? undefined,
    clickupListId: r.clickup_list_id ?? undefined,
    trelloBoardId: r.trello_board_id ?? undefined,
    adAccountId: r.ad_account_id ?? undefined,
    adsActive: r.ads_active,
  }));
  cache = { clients, at: Date.now() };
  return clients;
}

export async function getClient(id: string): Promise<Client | null> {
  return (await getClients()).find((c) => c.id === id) ?? null;
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npm run build`
Expected: limpo. Nenhuma rota existente muda nesta task.

- [ ] **Step 3: Commit**

```bash
git add src/lib/clients.ts
git commit -m "feat(admin): getClients/getClient lendo do banco com fallback pro array"
```

---

### Task 3: Sessão e auth de admin

**Files:**
- Create: `src/lib/adminSession.ts`
- Create: `src/app/api/admin/auth/login/route.ts`
- Create: `src/app/api/admin/auth/logout/route.ts`

**Interfaces:**
- Consumes: `admin_users` (Task 1); padrão HMAC de `src/lib/session.ts` (ler antes de escrever — copiar o mecanismo, não importar).
- Produces: `signAdminSession(adminUserId: string, agencyId: string): string`, `verifyAdminSession(cookieValue: string | undefined): { adminUserId: string; agencyId: string } | null`, `ADMIN_SESSION_COOKIE_NAME = "admin_session"`, `verifyAdminRequest(): Promise<{ adminUserId: string; agencyId: string } | null>` (via `cookies()` como `lib/access.ts`).

- [ ] **Step 1: Criar `adminSession.ts`**

Mesmo formato de `session.ts` (payload base64url + HMAC-SHA256 + `timingSafeEqual`), com payload `{ adminUserId, agencyId, exp }`, validade 7 dias, secret `ADMIN_SESSION_SECRET` (env nova — adicionar ao `.env.example` com comentário). Exportar também `verifyAdminRequest()` que lê o cookie via `next/headers`.

- [ ] **Step 2: Rota de login**

`POST /api/admin/auth/login` — corpo `{ email, password }`. Fluxo igual ao login de cliente (`src/app/api/auth/login/route.ts`, ler antes): rate limit reusando `checkRateLimit("admin-login:" + ip, 900, 10)` de `src/lib/rateLimit.ts`, `signInWithPassword` com anon key, depois busca em `admin_users` por `user_id`; se não achar → 401 `invalid_credentials` (um cliente comum NÃO pode logar no admin). Sucesso → cookie `admin_session` HttpOnly/SameSite=Lax/Secure em prod, `Max-Age` 7 dias, retorna `{ ok: true }`.

- [ ] **Step 3: Rota de logout**

`POST /api/admin/auth/logout` — expira o cookie (`Max-Age=0`), mesmo padrão de `src/app/api/auth/logout/route.ts` (ler antes).

- [ ] **Step 4: Verificar + commit**

Run: `npx tsc --noEmit && npm run build` → limpo.

```bash
git add src/lib/adminSession.ts src/app/api/admin/auth .env.example
git commit -m "feat(admin): sessao propria + rotas de login/logout com rate limit"
```

*Nota: Google OAuth fica pra task própria no fim (Task 9) — exige config manual no console Supabase.*

---

### Task 4: Proxy — host admin.* e proteção da árvore /admin

**Files:**
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `verifySession` (atual) e `verifyAdminSession` (Task 3 — usar a função pura, não a versão com `cookies()`).
- Produces: roteamento — `admin.cliqueboost.io/*` reescreve pra `/admin/*`; paths `/admin/*` e `/api/admin/*` exigem `admin_session` (exceto `/admin/login` e `/api/admin/auth/*`).

- [ ] **Step 1: Adicionar a lógica de admin ANTES da lógica de cliente existente**

```ts
const ADMIN_PUBLIC_PATHS = ["/admin/login", "/api/admin/auth/login", "/api/admin/auth/logout"];

// dentro de proxy(request):
const host = request.headers.get("host") ?? "";
const isAdminHost = host.startsWith("admin.");
let pathname = request.nextUrl.pathname;

// admin.cliqueboost.io/clientes → /admin/clientes (rewrite interno, URL do usuário fica limpa)
if (isAdminHost && !pathname.startsWith("/admin") && !pathname.startsWith("/api/") && !/\.[a-zA-Z0-9]+$/.test(pathname) && !pathname.startsWith("/_next/")) {
  const url = request.nextUrl.clone();
  url.pathname = `/admin${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
  if (ADMIN_PUBLIC_PATHS.some((p) => pathname === p)) return NextResponse.next();
  const adminSession = verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value);
  if (!adminSession) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}
```

Atenção: o parse de `clientIdInPath` existente NÃO deve tratar `admin` como clientId — o bloco acima retorna antes, garantir a ordem.

- [ ] **Step 2: Verificar + commit**

Run: `npx tsc --noEmit && npm run build` → limpo. Teste manual: `curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/admin/anything` → 401; `curl -sI localhost:3000/admin/clientes` → redirect a `/admin/login`.

```bash
git add src/proxy.ts
git commit -m "feat(admin): proxy roteia host admin.* e protege /admin com admin_session"
```

---

### Task 5: Layout do admin + tela de login

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/components/admin/AdminSidebar.tsx`
- Create: `src/components/admin/AdminLoginForm.tsx`

**Interfaces:**
- Consumes: rotas de auth (Task 3); `Logo` (`@/components/layout/Logo`); tokens de `globals.css`.
- Produces: shell com sidebar (itens: Clientes, Indicações, Faturamento — rotas `/admin/clientes`, `/admin/indicacoes`, `/admin/faturamento`) + botão Sair. Páginas das tasks 6-8 renderizam dentro.

- [ ] **Step 1: Layout com sidebar**

Ler `src/components/layout/Sidebar.tsx` e `AppFrame.tsx` primeiro e seguir o mesmo vocabulário visual (mesmas classes de card/border/hover). Sidebar fixa à esquerda com `Logo` no topo, os 3 itens com ícones inline (SVG próprios, padrão do projeto — não lucide), item ativo destacado por `usePathname()`. `layout.tsx` envolve `children`; a página de login NÃO usa o layout com sidebar (checar pathname ou usar route group `(authed)` — preferir route group: `src/app/admin/(authed)/layout.tsx` com sidebar, login fora dele).

- [ ] **Step 2: Login**

`AdminLoginForm` client component: email/senha, POST `/api/admin/auth/login`, sucesso → `router.push("/admin/clientes")`; erro 429 → "Muitas tentativas..."; outros → "Email ou senha inválidos.". Visual: reusar o estilo da tela de login do cliente (`src/app/login/page.tsx` — sem o hero; card centralizado com título "Admin — Clique Boost").

- [ ] **Step 3: Verificar + commit**

Run: `npx tsc --noEmit && npm run build` → limpo.

```bash
git add src/app/admin src/components/admin
git commit -m "feat(admin): shell com sidebar + tela de login"
```

---

### Task 6: Módulo Clientes (lista, criar, editar)

**Files:**
- Create: `src/app/admin/(authed)/clientes/page.tsx`
- Create: `src/components/admin/ClientesPageClient.tsx`
- Create: `src/app/api/admin/clients/route.ts` (GET lista, POST cria)
- Create: `src/app/api/admin/clients/[id]/route.ts` (GET um, PATCH edita)

**Interfaces:**
- Consumes: tabela `clients` (Task 1), `client_settings`/`client_accounts` (existentes), `verifyAdminRequest` (Task 3), `getSupabaseAdmin`.
- Produces: API JSON — GET `/api/admin/clients` → `{ clients: AdminClient[] }` onde `AdminClient = { id, name, active, instagramBusinessId, clickupListId, trelloBoardId, adsActive, planName, paymentStatus, hasLogin }`; POST cria cliente + login.

- [ ] **Step 1: Rota GET lista**

Toda rota `/api/admin/*` começa com `const admin = await verifyAdminRequest(); if (!admin) return 401`. GET junta `clients` + `client_settings` (plan_name, payment_status) + existência em `client_accounts` (hasLogin). Uma query por tabela, join em memória (6-50 clientes, irrelevante).

- [ ] **Step 2: Rota POST criar cliente**

Corpo: `{ id, name, email, password, instagramBusinessId?, clickupListId?, trelloBoardId? }`. Validações: `id` slug (`/^[a-z0-9-]{2,30}$/`), nome não vazio, email válido, senha ≥ 8 chars; `id` duplicado → 409. Fluxo:
1. `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
2. insert em `clients` (agency_id `'cliqueboost'` — na v1 vem do `verifyAdminRequest().agencyId`)
3. insert em `client_accounts` (`user_id` → `client_id`)
4. insert em `client_settings` (linha vazia com client_id)
Se qualquer passo falhar depois do createUser, deletar o auth user criado (`auth.admin.deleteUser`) — sem usuário órfão.

- [ ] **Step 3: Rota PATCH editar**

Campos editáveis: `name, instagramBusinessId, clickupListId, trelloBoardId, adAccountId, adsActive, active` (em `clients`) e `planName, paymentStatus, stripeCustomerId, stripeSubscriptionId` (em `client_settings`). Ignorar chaves desconhecidas. `active: false` = cliente pausado (some de `getClients()` e portanto do login/rotas — comportamento herdado automático).

- [ ] **Step 4: UI**

`ClientesPageClient`: tabela (nome, plano, status pagamento, ícones de integração ativa, chip Ativo/Pausado) + botão "Novo cliente" (modal com o form do POST, incluindo campo de senha gerada — botão "gerar senha" com `crypto.randomUUID().slice(0, 12)`) + clique na linha abre modal de edição (form do PATCH). Visual: seguir `TasksTable.tsx`/`ContaPageClient.tsx` como referência de tabela/form já existentes. Após criar, mostrar o email/senha uma única vez com botão copiar ("anota agora — a senha não fica salva aqui").

- [ ] **Step 5: Verificar + commit**

Run: `npx tsc --noEmit && npm run build` → limpo.

```bash
git add src/app/admin src/app/api/admin/clients src/components/admin
git commit -m "feat(admin): modulo clientes (lista, criar com login, editar)"
```

---

### Task 7: Módulo Indicações

**Files:**
- Create: `src/app/admin/(authed)/indicacoes/page.tsx`
- Create: `src/components/admin/IndicacoesPageClient.tsx`
- Create: `src/app/api/admin/referrals/route.ts` (GET todas)
- Create: `src/app/api/admin/referrals/[id]/convert/route.ts` (POST marca conversão)
- Modify: `src/lib/referralLeads.ts` (adicionar `fetchAllReferralLeads` e `markConverted`)

**Interfaces:**
- Consumes: `referral_leads` (existente, com status da sessão de 2026-08-07), `getClients` (Task 2), `verifyAdminRequest` (Task 3).
- Produces: `fetchAllReferralLeads(): Promise<(ReferralLead & { referrerClientId: string; convertedClientId: string | null })[]>`; `markConverted(leadId: string, convertedClientId: string): Promise<void>`.

- [ ] **Step 1: Extensões em `referralLeads.ts`**

`fetchAllReferralLeads` = mesma query de `fetchReferralLeads` sem o `.eq("referrer_client_id")`, incluindo `referrer_client_id` e `converted_client_id` no retorno. `markConverted` = `update({ converted_client_id }).eq("id", leadId)`, e valida antes que o lead não tem `discount_applied_at` (não reconverter lead já premiado — retornar erro claro).

- [ ] **Step 2: Rotas**

GET junta leads + nomes dos clientes (indicador e convertido) via `getClients()`. POST convert: corpo `{ convertedClientId }`, valida que o cliente existe (`getClient`), chama `markConverted`. A premiação continua 100% no webhook Stripe — o admin só cria o vínculo que hoje era SQL manual.

- [ ] **Step 3: UI**

Tabela: indicador → indicado (nome/contato) → data → chip de status (reusar os labels de `ContaIndicacoesSection.tsx`: Aguardando/Virou cliente/Desconto aplicado/Não qualificou) → ação "Marcar conversão" (dropdown de clientes ativos) visível só em status `pending`. Filtro simples por status no topo.

- [ ] **Step 4: Verificar + commit**

```bash
git add src/app/admin src/app/api/admin/referrals src/components/admin src/lib/referralLeads.ts
git commit -m "feat(admin): modulo indicacoes (visao geral + marcar conversao)"
```

---

### Task 8: Módulo Faturamento (consolidado)

**Files:**
- Create: `src/app/admin/(authed)/faturamento/page.tsx`
- Create: `src/components/admin/FaturamentoPageClient.tsx`
- Create: `src/app/api/admin/billing/route.ts` (GET consolidado)

**Interfaces:**
- Consumes: `client_payments` + `client_settings` (existentes), `getClients` (Task 2), `getStripe` (`src/lib/stripe.ts`), `verifyAdminRequest`.
- Produces: GET `/api/admin/billing` → `{ mrr: number | null, clients: BillingRow[] }` onde `BillingRow = { clientId, name, planName, paymentStatus, stripeLinked: boolean, lastPaymentAt: string | null, lastPaymentAmount: number | null }`.

- [ ] **Step 1: Rota GET**

Por cliente: `client_settings` (plano/status/stripe ids) + último registro de `client_payments`. MRR: se `getStripe()` disponível, somar `stripe.subscriptions.list({ status: "active", limit: 100 })` → `items.data[0].price.unit_amount` de cada; sem Stripe configurado → `mrr: null` (a UI mostra "—" com aviso "Stripe não configurado"). `stripeLinked = !!stripe_customer_id`.

- [ ] **Step 2: UI**

Topo: 3 stat cards (MRR, clientes ativos, pagamentos este mês — contagem de `client_payments` no mês corrente). Tabela por cliente com as colunas de `BillingRow`; linha sem `stripeLinked` ganha destaque "sem vínculo Stripe" com atalho que abre o modal de edição do cliente (Task 6) na aba de faturamento. Reusar `MetricCard`-like visual (ver `src/components/dashboard/MetricCard.tsx` como referência, versão simplificada sem sparkline).

- [ ] **Step 3: Verificar + commit**

```bash
git add src/app/admin src/app/api/admin/billing src/components/admin
git commit -m "feat(admin): faturamento consolidado (MRR, status por cliente)"
```

---

### Task 9: Visão espelho do dashboard do cliente

**Files:**
- Modify: `src/lib/access.ts`
- Modify: `src/proxy.ts`
- Modify: `src/components/admin/ClientesPageClient.tsx` (link "Ver dashboard")

**Interfaces:**
- Consumes: `verifyAdminSession`/`ADMIN_SESSION_COOKIE_NAME` (Task 3).
- Produces: admin logado acessa `/{clientId}` e todas as rotas `/api/*/{clientId}` de qualquer cliente (leitura E escrita — o admin É a agência).

- [ ] **Step 1: `access.ts`**

```ts
export async function verifyClientSession(clientId: string): Promise<boolean> {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  if (session?.clientId === clientId) return true;
  // Admin logado enxerga qualquer cliente (visão espelho — spec admin fase 1)
  const adminSession = verifyAdminSession(store.get(ADMIN_SESSION_COOKIE_NAME)?.value);
  return adminSession !== null;
}
```

- [ ] **Step 2: `proxy.ts`**

No bloco de rotas de cliente (não-admin), aceitar também sessão de admin: onde hoje é `if (!session || (clientIdInPath && session.clientId !== clientIdInPath))`, permitir passar se `verifyAdminSession(...)` for válida. Assim `admin.cliqueboost.io` continua servindo só o admin, mas o admin logado em `dash.cliqueboost.io/{qualquer-cliente}` (ou clicando no link do módulo Clientes) entra.

- [ ] **Step 3: Link na UI**

Em cada linha do módulo Clientes: ação "Ver dashboard" → `href={`https://dash.cliqueboost.io/${c.id}`}` em dev `/${c.id}` (usar `process.env.NODE_ENV === "production" ? ... : ...` — ou mais simples: link relativo `/${c.id}` sempre, funciona nos dois hosts pois o cookie admin vale pro domínio).
Atenção: cookies não cruzam subdomínios por padrão. Setar o cookie `admin_session` com `Domain=.cliqueboost.io` em produção (ajustar Task 3: `process.env.NODE_ENV === "production" ? "; Domain=.cliqueboost.io" : ""`).

- [ ] **Step 4: Verificar + commit**

Run: `npx tsc --noEmit && npm run build` → limpo. Manual: logar no admin em dev, abrir `/{clientId}` de um cliente → dashboard carrega sem login de cliente.

```bash
git add src/lib/access.ts src/proxy.ts src/lib/adminSession.ts src/components/admin/ClientesPageClient.tsx
git commit -m "feat(admin): visao espelho — admin acessa dashboard de qualquer cliente"
```

---

### Task 10: Google OAuth no login do admin

**Files:**
- Modify: `src/components/admin/AdminLoginForm.tsx`
- Create: `src/app/api/admin/auth/google/route.ts` (callback)

**Interfaces:**
- Consumes: Supabase Auth OAuth (`signInWithOAuth({ provider: "google" })` + `exchangeCodeForSession`), `admin_users` (o email do Google TEM que existir em `admin_users` — senão 401).
- Produces: botão "Entrar com Google" funcional.

**Pré-requisito manual (documentar no PR, não bloquear as outras tasks):** ativar o provider Google no painel Supabase (Authentication → Providers) com OAuth client do Google Cloud. Sem isso o botão retorna erro claro "Google não configurado".

- [ ] **Step 1: Botão + fluxo**

Client: `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: origin + "/api/admin/auth/google" } })` usando client anon (criar inline com `SUPABASE_URL`/`SUPABASE_ANON_KEY` públicas — atenção: essas envs precisam virar `NEXT_PUBLIC_` ou o fluxo inicia server-side; **preferir iniciar server-side**: GET `/api/admin/auth/google?start=1` redireciona pra URL do OAuth gerada no servidor, sem expor env nova).
Callback: troca `code` por sessão, pega o email, busca em `admin_users`; achou → seta cookie `admin_session` e redireciona `/admin/clientes`; não achou → redireciona `/admin/login?error=nao_autorizado`.

- [ ] **Step 2: Verificar + commit**

```bash
git add src/app/api/admin/auth/google src/components/admin/AdminLoginForm.tsx
git commit -m "feat(admin): login com Google (restrito a admin_users)"
```

---

### Task 11: Migration de adoção + seed do primeiro admin + domínio

**Files:**
- Create: `supabase/migrations/0025_agency_adoption.sql`
- Modify: `ARCHITECTURE.md` (seção do admin)

- [ ] **Step 1: Migration de adoção**

```sql
-- supabase/migrations/0025_agency_adoption.sql
-- Tabelas pré-admin ganham agency_id, semeado com a Clique Boost.
alter table client_settings add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table referral_leads add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table client_payments add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table call_notes add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table client_calls add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table chat_messages add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table bug_reports add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
alter table client_ratings add column if not exists agency_id text not null default 'cliqueboost' references agencies(id);
```

E instruções (comentário SQL) pra criar o primeiro admin: criar user no Supabase Auth (painel) e `insert into admin_users (agency_id, user_id, name, email) values ('cliqueboost', '<uuid-do-auth>', 'Victor Ferro', 'contato.cliqueboost@gmail.com');`

- [ ] **Step 2: ARCHITECTURE.md**

Adicionar seção curta "Admin (`/admin`, admin.cliqueboost.io)" no mapa de pastas + atualizar a dívida de RLS mencionando que a fundação multi-tenant começou (agencies/agency_id).

- [ ] **Step 3: Checklist de infra (documentar no commit, executar com o Victor)**

- Vercel: adicionar domínio `admin.cliqueboost.io` ao projeto (Settings → Domains)
- Env nova em todos os ambientes: `ADMIN_SESSION_SECRET` (gerar com `openssl rand -base64 32`)
- Rodar migrations 0024 e 0025 no SQL Editor
- Criar o primeiro admin_user (instruções do Step 1)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0025_agency_adoption.sql ARCHITECTURE.md
git commit -m "feat(admin): migration de adocao de agency_id + docs e checklist de infra"
```

---

## Self-review (executado na escrita do plano)

- **Cobertura da spec (fase 1):** CRUD clientes ✓ (T6) · onboarding sem SQL ✓ (T6 cria auth+account+settings) · visão espelho ✓ (T9) · indicações com conversão ✓ (T7) · faturamento consolidado + vínculo Stripe ✓ (T8 + PATCH do T6) · auth email/senha + Google ✓ (T3, T10) · multi-tenant ✓ (T1, T11) · mesmo repo/host ✓ (T4).
- **Fora deste plano (consciente):** policies RLS das tabelas novas — entra quando a camada de dados migrar pra JWT (dívida documentada); UI de "reprocessar desconto manual" (spec menciona como exceção — a conversão via T7 já dispara o fluxo automático; ação manual direta no Stripe continua possível e rara).
- **Consistência de tipos:** `AdminClient`, `BillingRow`, `ReferralLead` (com `status`) definidos nas tasks que os produzem e citados nas que consomem.
