# Conta — Perfil & Faturamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reverter a repintura de dashboard da feature Marca (mantendo só a foto/logo) e redesenhar a página Conta em dois cards novos: Perfil (nome, e-mail, foto) e Faturamento (plano, status, histórico de pagamentos, tempo de contrato).

**Architecture:** Task 1 remove código morto e a coluna `brand_color`. Task 2 adiciona as colunas/tabela novas de perfil+faturamento e as funções de acesso a dado. Task 3 reconstrói `ContaPageClient.tsx` em cima da nova forma da API.

**Tech Stack:** Next.js App Router, Supabase (Postgres + Storage), TypeScript.

## Global Constraints

- Nenhuma UI de edição de plano/status/histórico de pagamentos — só o Victor atualiza, manualmente, pedindo direto (mesmo padrão das Atas/Tempo de contrato).
- E-mail é o único campo novo editável pelo próprio cliente.
- `client_payments` tem `id` de linha próprio (não é keyed por `client_id` como `client_settings`) — limpeza de teste deve ser por `id` específico, igual `call_notes` (nunca por `client_id` de cliente real).
- Nenhuma outra tela do dashboard (fora da página Conta) pode mudar de aparência por causa de `client_settings` — a Task 1 deve deixar isso estruturalmente impossível (arquivo que fazia isso é deletado, não só desligado por uma flag).
- Migrations são aditivas ou dropam só a coluna `brand_color` (que está vazia hoje, confirmado) — nenhuma outra coluna/tabela existente é tocada.

---

### Task 1: Reversão da Marca (cor)

**Files:**
- Delete: `src/app/[client]/layout.tsx`
- Delete: `src/app/api/conta/[client]/brand/route.ts`
- Delete: `src/lib/hexColor.ts`
- Create: `supabase/migrations/0009_client_settings_drop_brand_color.sql`
- Modify: `src/lib/clientSettings.ts`
- Modify: `src/app/api/conta/[client]/logo/route.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores desta rodada (é a primeira).
- Produces: `updateClientLogo(clientId: string, logoUrl: string): Promise<void>` (renomeada de `updateClientBrand`, só cuida de logo); `ClientSettings` sem o campo `brandColor`.

- [ ] **Step 1: Confirmar que `hexToHslTriplet` só é usado em `layout.tsx`**

Run: `grep -rn "hexToHslTriplet" src`
Expected: só aparece em `src/lib/hexColor.ts` (definição) e `src/app/[client]/layout.tsx` (uso). Se aparecer em outro lugar, PARE e reporte — não delete o arquivo.

- [ ] **Step 2: Deletar os 3 arquivos**

```bash
git rm src/app/[client]/layout.tsx src/app/api/conta/[client]/brand/route.ts src/lib/hexColor.ts
```

- [ ] **Step 3: Criar a migration de drop da coluna**

```sql
-- supabase/migrations/0009_client_settings_drop_brand_color.sql
alter table client_settings drop column if exists brand_color;
```

- [ ] **Step 4: Atualizar `clientSettings.ts`**

Estado atual (leia o arquivo antes de editar — pode ter mudado levemente pela Task de Tempo de contrato):

```ts
export type ClientSettings = {
  timeZone: string;
  brandColor: string | null;
  logoUrl: string | null;
  contractStart: string | null;
};
```

Novo estado (remove `brandColor`, remove `updateClientBrand`, adiciona `updateClientLogo`):

```ts
export type ClientSettings = {
  timeZone: string;
  logoUrl: string | null;
  contractStart: string | null;
};

export async function fetchClientSettings(clientId: string): Promise<ClientSettings> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_settings")
    .select("time_zone, logo_url, contract_start_date")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    timeZone: data?.time_zone ?? DEFAULT_TIME_ZONE,
    logoUrl: data?.logo_url ?? null,
    contractStart: data?.contract_start_date ?? null,
  };
}

// updateClientSettings (timeZone) fica igual, não mexer

export async function updateClientLogo(clientId: string, logoUrl: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("client_settings")
    .upsert({ client_id: clientId, logo_url: logoUrl }, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}
```

(A Task 2 vai adicionar `contactEmail`/`planName`/`paymentStatus` a este mesmo tipo — não se preocupe com eles aqui.)

- [ ] **Step 5: Atualizar `src/app/api/conta/[client]/logo/route.ts`**

Troque a linha:
```ts
import { updateClientBrand } from "@/lib/clientSettings";
```
por:
```ts
import { updateClientLogo } from "@/lib/clientSettings";
```
E troque a chamada:
```ts
await updateClientBrand(clientId, { logoUrl: data.publicUrl });
```
por:
```ts
await updateClientLogo(clientId, data.publicUrl);
```

- [ ] **Step 6: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `src/app/api/conta/[client]/route.ts` ou `ContaPageClient.tsx` quebrarem por causa do `brandColor` removido do tipo, é esperado — a Task 2/3 corrigem isso. Se for erro nesses 2 arquivos específicos por causa de `brandColor`, ok prosseguir; qualquer outro erro, investigue.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: reverte repintura de dashboard (Marca) - mantém só foto de perfil"
```

**Após este commit: PARE e peça para o Victor rodar a migration `0009_client_settings_drop_brand_color.sql` antes de prosseguir pra Task 2.**

---

### Task 2: Migration Perfil/Faturamento + clientSettings + clientPayments + rotas

**Files:**
- Create: `supabase/migrations/0010_client_settings_profile_billing.sql`
- Create: `src/lib/clientPayments.ts`
- Modify: `src/lib/clientSettings.ts`
- Modify: `src/app/api/conta/[client]/route.ts`
- Create: `src/app/api/conta/[client]/email/route.ts`

**Interfaces:**
- Consumes: `ClientSettings` e `fetchClientSettings`/`updateClientLogo` da Task 1.
- Produces: `ClientSettings` com `contactEmail`, `planName`, `paymentStatus`; `updateContactEmail(clientId, email): Promise<void>`; `fetchClientPayments(clientId): Promise<ClientPayment[]>` onde `ClientPayment = { id: string; paidAt: string; amount: number | null }`; rota GET devolve `payments: ClientPayment[]` além dos campos já existentes; nova rota `PUT /api/conta/[client]/email`.

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0010_client_settings_profile_billing.sql
alter table client_settings add column if not exists contact_email text;
alter table client_settings add column if not exists plan_name text;
alter table client_settings add column if not exists payment_status text;

create table if not exists client_payments (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  paid_at date not null,
  amount numeric,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Estender `ClientSettings` e `fetchClientSettings`**

```ts
export type ClientSettings = {
  timeZone: string;
  logoUrl: string | null;
  contractStart: string | null;
  contactEmail: string | null;
  planName: string | null;
  paymentStatus: string | null;
};

export async function fetchClientSettings(clientId: string): Promise<ClientSettings> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_settings")
    .select("time_zone, logo_url, contract_start_date, contact_email, plan_name, payment_status")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    timeZone: data?.time_zone ?? DEFAULT_TIME_ZONE,
    logoUrl: data?.logo_url ?? null,
    contractStart: data?.contract_start_date ?? null,
    contactEmail: data?.contact_email ?? null,
    planName: data?.plan_name ?? null,
    paymentStatus: data?.payment_status ?? null,
  };
}

export async function updateContactEmail(clientId: string, email: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("client_settings")
    .upsert({ client_id: clientId, contact_email: email }, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3: Criar `src/lib/clientPayments.ts`**

```ts
// src/lib/clientPayments.ts
import { getSupabaseAdmin } from "./supabase";

export type ClientPayment = { id: string; paidAt: string; amount: number | null };

export async function fetchClientPayments(clientId: string): Promise<ClientPayment[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_payments")
    .select("id, paid_at, amount")
    .eq("client_id", clientId)
    .order("paid_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, paidAt: row.paid_at, amount: row.amount }));
}
```

- [ ] **Step 4: Estender a rota GET `/api/conta/[client]`**

Leia o arquivo (estado atual mostrado abaixo, pode já ter mudado um pouco):

```ts
// GET atual
const settings = await fetchClientSettings(clientId);
return Response.json({
  ...settings,
  contractDuration: formatContractDuration(settings.contractStart, new Date()),
});
```

Novo (adiciona `fetchClientPayments` em paralelo):

```ts
import { fetchClientPayments } from "@/lib/clientPayments";
// ...
const [settings, payments] = await Promise.all([
  fetchClientSettings(clientId),
  fetchClientPayments(clientId),
]);
return Response.json({
  ...settings,
  contractDuration: formatContractDuration(settings.contractStart, new Date()),
  payments,
});
```

- [ ] **Step 5: Criar `src/app/api/conta/[client]/email/route.ts`**

```ts
// src/app/api/conta/[client]/email/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { updateContactEmail } from "@/lib/clientSettings";
import { verifyClientToken } from "@/lib/access";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PUT(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const email = body?.email;
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await updateContactEmail(clientId, email);
    return Response.json({ email });
  } catch (err) {
    console.error(`[conta] falha ao salvar e-mail de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 6: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos (o único erro esperado remanescente, se houver, é em `ContaPageClient.tsx` por causa do `brandColor`/`updateClientBrand` que a Task 3 resolve).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0010_client_settings_profile_billing.sql src/lib/clientPayments.ts src/lib/clientSettings.ts src/app/api/conta/[client]/route.ts src/app/api/conta/[client]/email/route.ts
git commit -m "feat: colunas de perfil/faturamento + client_payments + rota de e-mail"
```

**Após este commit: PARE e peça para o Victor rodar a migration `0010_client_settings_profile_billing.sql` antes de prosseguir pra Task 3.**

---

### Task 3: Reconstrução de `ContaPageClient.tsx` (cards Perfil + Faturamento)

**Files:**
- Modify: `src/components/ContaPageClient.tsx`

**Interfaces:**
- Consumes: resposta GET de `/api/conta/${clientId}` agora devolve `{ timeZone, logoUrl, contractStart, contractDuration, contactEmail, planName, paymentStatus, payments: { id, paidAt, amount }[] }` (Tasks 1-2). Rotas: `PUT /api/conta/[client]` (timeZone, já existia), `PUT /api/conta/[client]/email` (email, nova), `POST /api/conta/[client]/logo` (upload, já existia).
- Este componente recebe `clientName: string` como nova prop (o "Nome" do card Perfil vem de `CLIENTS`, não do banco — precisa ser passado pelo `page.tsx`).

- [ ] **Step 1: Atualizar `src/app/[client]/conta/page.tsx` pra passar o nome**

Leia o arquivo primeiro (mostrado no contexto abaixo). Troque a linha do componente:

```tsx
<ContaPageClient clientId={found.id} accessKey={key!} />
```
por:
```tsx
<ContaPageClient clientId={found.id} clientName={found.name} accessKey={key!} />
```

- [ ] **Step 2: Reescrever `ContaPageClient.tsx`**

Reescreva o arquivo inteiro assim (mantém o card "Fuso horário" como está hoje, remove o card "Marca" inteiro, adiciona "Perfil" e "Faturamento"):

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { US_TIMEZONES } from "@/lib/clientTime";

type Status = "loading" | "error" | "ready";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type Payment = { id: string; paidAt: string; amount: number | null };

export function ContaPageClient({
  clientId,
  clientName,
  accessKey,
}: {
  clientId: string;
  clientName: string;
  accessKey: string;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [timeZone, setTimeZone] = useState<string>("America/New_York");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const [contactEmail, setContactEmail] = useState<string>("");
  const [emailSaveStatus, setEmailSaveStatus] = useState<SaveStatus>("idle");

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<SaveStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [planName, setPlanName] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contractDuration, setContractDuration] = useState<string>("Ainda não configurado");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as {
          timeZone: string;
          logoUrl: string | null;
          contactEmail: string | null;
          planName: string | null;
          paymentStatus: string | null;
          contractDuration: string;
          payments: Payment[];
        };
      })
      .then((data) => {
        if (!cancelled) {
          setTimeZone(data.timeZone);
          setContactEmail(data.contactEmail ?? "");
          setLogoUrl(data.logoUrl);
          setPlanName(data.planName);
          setPaymentStatus(data.paymentStatus);
          setContractDuration(data.contractDuration);
          setPayments(data.payments);
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

  function handleSaveTimeZone() {
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

  function handleSaveEmail() {
    setEmailSaveStatus("saving");
    fetch(`/api/conta/${clientId}/email?key=${encodeURIComponent(accessKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: contactEmail }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setEmailSaveStatus("saved");
      })
      .catch(() => setEmailSaveStatus("error"));
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("saving");
    const formData = new FormData();
    formData.append("logo", file);
    fetch(`/api/conta/${clientId}/logo?key=${encodeURIComponent(accessKey)}`, {
      method: "POST",
      body: formData,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        setLogoUrl(data.logoUrl);
        setUploadStatus("saved");
      })
      .catch(() => setUploadStatus("error"));
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
        <div className="flex max-w-md flex-col gap-6">
          <div className="rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
            <h2 className="mb-1 text-sm font-bold text-card-foreground">Perfil</h2>
            <p className="mb-4 text-xs text-muted-foreground">Informações básicas da sua conta.</p>

            <label className="mb-1 block text-xs font-semibold text-card-foreground">Nome</label>
            <p className="mb-4 text-sm text-foreground">{clientName}</p>

            <label className="mb-1 block text-xs font-semibold text-card-foreground">E-mail cadastrado</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                setEmailSaveStatus("idle");
              }}
              placeholder="seu@email.com"
              className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={handleSaveEmail}
              disabled={emailSaveStatus === "saving"}
              className="mb-6 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {emailSaveStatus === "saving" ? "Salvando..." : "Salvar e-mail"}
            </button>
            {emailSaveStatus === "saved" && <p className="-mt-4 mb-6 text-xs text-green-600">Salvo com sucesso.</p>}
            {emailSaveStatus === "error" && <p className="-mt-4 mb-6 text-xs text-red-500">Não foi possível salvar.</p>}

            <label className="mb-1 block text-xs font-semibold text-card-foreground">Foto de perfil</label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Foto de perfil"
                  className="h-14 w-14 rounded-md border border-border bg-background object-contain"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  Sem foto
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus === "saving"}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {uploadStatus === "saving" ? "Enviando..." : "Enviar foto"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>
            {uploadStatus === "saved" && <p className="mt-2 text-xs text-green-600">Foto atualizada.</p>}
            {uploadStatus === "error" && <p className="mt-2 text-xs text-red-500">Não foi possível enviar a foto.</p>}
          </div>

          <div className="rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
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
              onClick={handleSaveTimeZone}
              disabled={saveStatus === "saving"}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {saveStatus === "saving" ? "Salvando..." : "Salvar"}
            </button>
            {saveStatus === "saved" && <p className="mt-2 text-xs text-green-600">Salvo com sucesso.</p>}
            {saveStatus === "error" && <p className="mt-2 text-xs text-red-500">Não foi possível salvar.</p>}
          </div>

          <div className="rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
            <h2 className="mb-1 text-sm font-bold text-card-foreground">Faturamento</h2>
            <p className="mb-4 text-xs text-muted-foreground">Plano, pagamentos e tempo de contrato.</p>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-card-foreground">Plano</p>
                <p className="text-sm text-foreground">{planName ?? "Não configurado"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-card-foreground">Status de pagamento</p>
                <p className="text-sm text-foreground">{paymentStatus ?? "Não configurado"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-card-foreground">Tempo de contrato</p>
                <p className="text-sm text-foreground">{contractDuration}</p>
              </div>
            </div>

            <p className="mb-2 text-xs font-semibold text-card-foreground">Histórico de pagamentos</p>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between text-sm text-foreground">
                    <span>{p.paidAt}</span>
                    {p.amount != null && <span>R$ {p.amount.toFixed(2)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificação visual ao vivo (cliente sandbox Tiago)**

1. Confirmar `client_settings` vazia pra `client_id=eq.tiago` (GET antes) e `client_payments` sem linhas pra `client_id=eq.tiago`.
2. Abrir a página Conta do Tiago no preview — confirmar os 3 cards (Perfil, Fuso horário, Faturamento), plano/status "Não configurado", histórico "Nenhum pagamento registrado ainda", tempo de contrato "Ainda não configurado".
3. Testar salvar e-mail: digitar um e-mail de teste, salvar, recarregar a página, confirmar que persiste. Depois reverter: `UPDATE client_settings SET contact_email = null WHERE client_id = 'tiago'`.
4. Testar upload de foto: já era testado antes como "logo", deve continuar funcionando igual — não precisa re-testar o upload em si, só confirmar que o rótulo mudou pra "Foto de perfil" na tela.
5. Testar histórico de pagamentos: `INSERT INTO client_payments (client_id, paid_at, amount) VALUES ('tiago', '2026-06-01', 500)` via curl (anote o `id` retornado com `Prefer: return=representation`), recarregar a página, confirmar que aparece na lista. Depois `DELETE` esse `id` específico (não por `client_id`).
6. Confirmar que outras páginas do Tiago (ex: Dashboard) continuam com a cor padrão da Clique Boost, não mudam de aparência.
7. Confirmar `client_settings` e `client_payments` sem resíduo de teste ao final pro Tiago.

- [ ] **Step 5: Commit**

```bash
git add src/components/ContaPageClient.tsx src/app/[client]/conta/page.tsx
git commit -m "feat: reconstrói página Conta com cards Perfil e Faturamento"
```

## Verificação

- `npx tsc --noEmit` limpo em todas as 3 tasks.
- `npm run build` limpo ao final da Task 3.
- Nenhuma página fora de Conta muda de cor.
- E-mail, foto de perfil e histórico de pagamentos funcionam de ponta a ponta no cliente sandbox Tiago, sem resíduo de teste ao final.
