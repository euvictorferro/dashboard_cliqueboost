# Conta — Indicação de Amigos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada cliente ganha um link público de indicação (`/r/<client_id>`) que leva a uma página de captação de lead; leads viram um card "Indicação de amigos" na página Conta.

**Architecture:** Task 1 constrói a página pública + formulário + rota de captação (sem autenticação, protegida só por validação de `client_id` real). Task 2 estende a rota GET de Conta e adiciona o card na UI já autenticada.

**Tech Stack:** Next.js App Router, Supabase (Postgres), TypeScript.

## Global Constraints

- A rota `/r/[code]` e a rota `POST /api/referrals` são **públicas** — não usam `verifyClientToken`. A única validação é `CLIENTS.find(c => c.id === code)` (404 se não existir) e validação básica dos campos do formulário.
- `referral_leads.id` é chave própria de linha (igual `client_payments`) — limpeza de teste é por `id` específico, nunca por `referrer_client_id`.
- A migration já vem com RLS ligado desde o início (`alter table referral_leads enable row level security;`) — não repetir o esquecimento da rodada anterior.
- Sem campo de recompensa/desconto — não existe hoje, não adicionar coluna especulativa.
- O link mostrado na Conta é sempre `${origin}/r/${clientId}` — nunca um código separado armazenado no banco.

---

### Task 1: Migration + referralLeads.ts + página pública `/r/[code]` + rota POST

**Files:**
- Create: `supabase/migrations/0012_referral_leads.sql`
- Create: `src/lib/referralLeads.ts`
- Create: `src/app/r/[code]/page.tsx`
- Create: `src/components/ReferralLeadForm.tsx`
- Create: `src/app/api/referrals/route.ts`

**Interfaces:**
- Consumes: `CLIENTS` de `src/lib/clients.ts` (já existe); `getSupabaseAdmin` de `src/lib/supabase.ts` (já existe).
- Produces: `fetchReferralLeads(clientId: string): Promise<ReferralLead[]>` e `createReferralLead(referrerClientId: string, name: string, contact: string): Promise<void>` exportadas de `src/lib/referralLeads.ts`, onde `ReferralLead = { id: string; name: string; contact: string; createdAt: string }`. Rota `POST /api/referrals` aceita `{ referrerClientId: string; name: string; contact: string }`.

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0012_referral_leads.sql
create table if not exists referral_leads (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id text not null,
  name text not null,
  contact text not null,
  created_at timestamptz not null default now()
);

-- RLS ligado e sem policies: só a Service Role Key (usada no servidor) acessa esta tabela.
alter table referral_leads enable row level security;
```

- [ ] **Step 2: Criar `src/lib/referralLeads.ts`**

```ts
// src/lib/referralLeads.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export type ReferralLead = { id: string; name: string; contact: string; createdAt: string };

export async function fetchReferralLeads(clientId: string): Promise<ReferralLead[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("referral_leads")
    .select("id, name, contact, created_at")
    .eq("referrer_client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, contact: row.contact, createdAt: row.created_at }));
}

export async function createReferralLead(referrerClientId: string, name: string, contact: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("referral_leads")
    .insert({ referrer_client_id: referrerClientId, name, contact });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3: Criar `src/app/api/referrals/route.ts` (rota pública)**

```ts
// src/app/api/referrals/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { createReferralLead } from "@/lib/referralLeads";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const referrerClientId = body?.referrerClientId;
  const name = body?.name;
  const contact = body?.contact;

  if (typeof referrerClientId !== "string" || !CLIENTS.some((c) => c.id === referrerClientId)) {
    return Response.json({ error: "unknown_referrer" }, { status: 404 });
  }
  if (typeof name !== "string" || name.trim().length === 0 || typeof contact !== "string" || contact.trim().length === 0) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await createReferralLead(referrerClientId, name.trim(), contact.trim());
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[referrals] falha ao salvar lead indicado por ${referrerClientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

Note: esta rota **não** chama `verifyClientToken` — é pública de propósito (quem preenche o formulário não é cliente logado). A validação é só "o `referrerClientId` existe em `CLIENTS`" + campos não-vazios.

- [ ] **Step 4: Criar `src/components/ReferralLeadForm.tsx`**

```tsx
// src/components/ReferralLeadForm.tsx
"use client";

import { useState } from "react";

type Status = "idle" | "saving" | "saved" | "error";

export function ReferralLeadForm({ referrerClientId }: { referrerClientId: string }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    fetch("/api/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrerClientId, name, contact }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("saved");
      })
      .catch(() => setStatus("error"));
  }

  if (status === "saved") {
    return (
      <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-card-foreground shadow-[var(--shadow-soft)]">
        Recebemos seu contato! Em breve alguém da Clique Boost fala com você.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
      <label className="text-xs font-semibold text-card-foreground">Nome</label>
      <input
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <label className="text-xs font-semibold text-card-foreground">WhatsApp</label>
      <input
        type="text"
        required
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="(00) 00000-0000"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <button
        type="submit"
        disabled={status === "saving"}
        className="mt-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
      >
        {status === "saving" ? "Enviando..." : "Quero saber mais"}
      </button>
      {status === "error" && <p className="text-xs text-red-500">Não foi possível enviar, tenta de novo.</p>}
    </form>
  );
}
```

- [ ] **Step 5: Criar `src/app/r/[code]/page.tsx`**

```tsx
// src/app/r/[code]/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { Logo } from "@/components/Logo";
import { ReferralLeadForm } from "@/components/ReferralLeadForm";

export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const client = CLIENTS.find((c) => c.id === code);
  if (!client) notFound();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-4 px-4 py-16">
      <Logo />
      <h1 className="mt-4 text-xl font-semibold text-foreground">Você foi indicado pela Clique Boost</h1>
      <p className="text-sm text-muted-foreground">
        {client.name} te indicou pra gente. Deixa seu contato que alguém da equipe te chama.
      </p>
      <ReferralLeadForm referrerClientId={client.id} />
    </div>
  );
}
```

Leia `src/components/Logo.tsx` antes deste step pra confirmar a prop/uso correto (o `src/app/page.tsx` já mostra o padrão de uso: `<Logo />` sem props).

- [ ] **Step 6: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0012_referral_leads.sql src/lib/referralLeads.ts src/app/r/ src/components/ReferralLeadForm.tsx src/app/api/referrals/
git commit -m "feat: página pública de indicação /r/[code] + captação de lead"
```

**Após este commit: PARE e peça para o Victor rodar a migration `0012_referral_leads.sql` antes de prosseguir pra Task 2.**

---

### Task 2: Card "Indicação de amigos" na página Conta

**Files:**
- Modify: `src/app/api/conta/[client]/route.ts`
- Modify: `src/components/ContaPageClient.tsx`

**Interfaces:**
- Consumes: `fetchReferralLeads` de `src/lib/referralLeads.ts` (Task 1).
- Produces: resposta GET de `/api/conta/[client]` ganha `referralLeads: { id, name, contact, createdAt }[]`.

- [ ] **Step 1: Estender a rota GET**

Leia o arquivo primeiro (estado atual: busca `settings` e `payments` em paralelo via `Promise.all`). Adicione `fetchReferralLeads` ao mesmo `Promise.all`:

```ts
import { fetchReferralLeads } from "@/lib/referralLeads";
// ...
const [settings, payments, referralLeads] = await Promise.all([
  fetchClientSettings(clientId),
  fetchClientPayments(clientId),
  fetchReferralLeads(clientId),
]);
return Response.json({
  ...settings,
  contractDuration: formatContractDuration(settings.contractStart, new Date()),
  payments,
  referralLeads,
});
```

- [ ] **Step 2: Adicionar o card em `ContaPageClient.tsx`**

Leia o arquivo primeiro (estado atual tem 3 cards: Perfil, Fuso horário, Faturamento). Adicione um novo tipo, estado, e capture do GET (mesmo padrão dos outros campos):

```ts
type ReferralLead = { id: string; name: string; contact: string; createdAt: string };
// no cast inline do .then: adicionar referralLeads: ReferralLead[]
const [referralLeads, setReferralLeads] = useState<ReferralLead[]>([]);
// no .then((data) => {...}): setReferralLeads(data.referralLeads);
```

Adicione um estado pro link copiado e o handler:

```ts
const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
const referralLink = typeof window !== "undefined" ? `${window.location.origin}/r/${clientId}` : "";

function handleCopyLink() {
  navigator.clipboard.writeText(referralLink).then(() => {
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 2000);
  });
}
```

Adicione o card (depois do card "Faturamento", mesmo container `flex flex-col gap-6`):

```tsx
<div className="rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
  <h2 className="mb-1 text-sm font-bold text-card-foreground">Indicação de amigos</h2>
  <p className="mb-4 text-xs text-muted-foreground">Compartilhe seu link e acompanhe quem você já indicou.</p>

  <div className="mb-4 flex items-center gap-2">
    <input
      type="text"
      readOnly
      value={referralLink}
      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
    />
    <button
      type="button"
      onClick={handleCopyLink}
      className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted"
    >
      {copyStatus === "copied" ? "Copiado!" : "Copiar"}
    </button>
  </div>

  <p className="mb-2 text-xs font-semibold text-card-foreground">Quem você já indicou</p>
  {referralLeads.length === 0 ? (
    <p className="text-sm text-muted-foreground">Nenhuma indicação ainda.</p>
  ) : (
    <ul className="flex flex-col gap-1">
      {referralLeads.map((lead) => (
        <li key={lead.id} className="flex justify-between text-sm text-foreground">
          <span>{lead.name}</span>
          <span className="text-muted-foreground">{lead.contact}</span>
        </li>
      ))}
    </ul>
  )}
</div>
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificação visual ao vivo (cliente sandbox Tiago)**

1. Confirmar `referral_leads` sem linhas pra `referrer_client_id=eq.tiago`.
2. Acessar `/r/tiago` (sem `?key=`) no preview — confirmar que a página pública carrega, com nome "Tiago Zamboni" na mensagem.
3. Acessar `/r/cliente-que-nao-existe` — confirmar 404.
4. Preencher o formulário com um lead de teste, enviar, confirmar mensagem de sucesso.
5. Abrir a página Conta do Tiago (`/tiago/conta?key=...`) — confirmar que o lead aparece na lista, e que o link mostrado é `http://localhost:<porta>/r/tiago` (ou o domínio do preview).
6. Clicar em "Copiar" e confirmar (via `navigator.clipboard` ou inspeção) que o valor copiado é o link certo.
7. Limpar: apagar o lead de teste por `id` específico (anote o `id` retornado no insert/visível na resposta do POST se logado, ou consulte por `referrer_client_id=eq.tiago` já que a tabela deveria estar vazia antes do teste — único registro presente é o de teste).
8. Confirmar `referral_leads` vazia de novo pra `tiago`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/conta/[client]/route.ts src/components/ContaPageClient.tsx
git commit -m "feat: card Indicação de amigos na página Conta"
```

## Verificação

- `npx tsc --noEmit` e `npm run build` limpos ao final da Task 2.
- `/r/[code]` funciona pra cliente real e devolve 404 pra código inexistente.
- Formulário salva o lead corretamente, vinculado ao `referrer_client_id` certo.
- Card na Conta mostra o link certo e a lista de indicados, sem resíduo de teste ao final.
