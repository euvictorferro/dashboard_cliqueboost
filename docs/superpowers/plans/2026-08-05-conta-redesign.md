# Página de Conta — Redesenho Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar `/[client]/conta` do zero: largura cheia com sub-sidebar de navegação
(identidade + 5 seções) à esquerda e conteúdo em cards à direita, usando um sistema de campo
"bloco preenchido" (label acima, valor num bloco `bg-muted`) em vez dos inputs com borda atuais.

**Architecture:** Um componente de apresentação por seção (`ContaPerfilSection`,
`ContaFusoSection`, `ContaFaturamentoSection`, `ContaIndicacoesSection`,
`ContaSegurancaSection`), um componente de navegação (`ContaSidebar`), e um campo compartilhado
(`ContaField`) reaproveitado pelas seções que têm inputs/valores em bloco. `ContaPageClient`
continua sendo o único componente com estado/fetch/handlers (nada de API nova), só troca o JSX
que ele renderiza pra delegar a cada seção.

**Tech Stack:** Next.js (App Router) + React + TypeScript + Tailwind, sem libs novas.

## Global Constraints

- Sem endpoint de API novo — todas as seções reaproveitam `/api/conta/[client]`,
  `/api/conta/[client]/email` e `/api/conta/[client]/logo`, que já existem e não mudam.
- Sem framework de testes no projeto (não há `vitest`/`jest` configurado) — a verificação de
  cada tarefa é `npx tsc --noEmit -p .` (zero erros) e, na tarefa final, `npm run build` +
  checagem visual manual no preview. Esse é o mesmo padrão usado no resto desta branch.
- Ícones em SVG inline (mesmo padrão de `CalendarIcons.tsx`/`BoosterAiPageClient.tsx`) — sem
  instalar `lucide-react` nem nenhuma lib de ícones.
- Tailwind: cards usam `rounded-lg border border-border bg-card` (padrão mais recente da
  branch), não a sombra `shadow-[var(--shadow-soft)]` antiga.
- Reaproveitar `getInitials`/`colorFromName` de `src/lib/avatar.ts` (já existe) pro avatar —
  não duplicar essa lógica.

---

## Task 1: Ícones da página de Conta

**Files:**
- Create: `src/components/ContaIcons.tsx`

**Interfaces:**
- Produces: `UserIcon()`, `ClockIcon()`, `CreditCardIcon()`, `LinkIcon()`, `LockIcon()` — cada
  um um componente React sem props, retornando um `<svg>` de 14×14.

- [ ] **Step 1: Criar o arquivo de ícones**

```tsx
// src/components/ContaIcons.tsx
export function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.75 12c.7-2.6 2.9-4 5.25-4s4.55 1.4 5.25 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 4v3.2l2.2 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CreditCardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="12" height="8" rx="1.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5.5 8.5L8.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M6.5 3.5l.9-.9a2.3 2.3 0 0 1 3.3 3.3l-.9.9M7.5 10.5l-.9.9a2.3 2.3 0 0 1-3.3-3.3l.9-.9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2.5" y="6.5" width="9" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 6.5V4.2a2.5 2.5 0 0 1 5 0V6.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContaIcons.tsx
git commit -m "feat(conta): ícones da sub-sidebar de Conta"
```

---

## Task 2: Campo compartilhado (`ContaField`)

**Files:**
- Create: `src/components/ContaField.tsx`

**Interfaces:**
- Consumes: nada (componente puro de apresentação).
- Produces: `ContaField({ label: string; badge?: ContaFieldBadge; children: ReactNode })`,
  tipo exportado `ContaFieldBadge = { label: string; tone: "success" | "warning" }`.

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/ContaField.tsx
"use client";

import type { ReactNode } from "react";

const BADGE_TONE_CLASSES = {
  success: "bg-brand-success/10 text-brand-success",
  warning: "bg-amber-500/10 text-amber-600",
} as const;

export type ContaFieldBadge = { label: string; tone: keyof typeof BADGE_TONE_CLASSES };

export function ContaField({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: ContaFieldBadge;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md bg-muted px-3 py-2.5 text-sm font-medium text-card-foreground">
          {children}
        </div>
        {badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE_CLASSES[badge.tone]}`}>
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContaField.tsx
git commit -m "feat(conta): componente de campo compartilhado (bloco preenchido + badge)"
```

---

## Task 3: Sub-sidebar de navegação (`ContaSidebar`)

**Files:**
- Create: `src/components/ContaSidebar.tsx`

**Interfaces:**
- Consumes: `getInitials`, `colorFromName` de `src/lib/avatar.ts` (já existem); `UserIcon`,
  `ClockIcon`, `CreditCardIcon`, `LinkIcon`, `LockIcon` de `./ContaIcons` (Task 1).
- Produces: tipo exportado `ContaSection = "perfil" | "fuso" | "faturamento" | "indicacoes" |
  "seguranca"`; componente `ContaSidebar({ clientName: string; email: string; logoUrl: string
  | null; active: ContaSection; onSelect: (section: ContaSection) => void })`.

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/ContaSidebar.tsx
"use client";

import { getInitials, colorFromName } from "@/lib/avatar";
import { UserIcon, ClockIcon, CreditCardIcon, LinkIcon, LockIcon } from "./ContaIcons";

export type ContaSection = "perfil" | "fuso" | "faturamento" | "indicacoes" | "seguranca";

const NAV_ITEMS: { id: ContaSection; label: string; Icon: () => React.ReactElement }[] = [
  { id: "perfil", label: "Perfil", Icon: UserIcon },
  { id: "fuso", label: "Fuso horário", Icon: ClockIcon },
  { id: "faturamento", label: "Faturamento", Icon: CreditCardIcon },
  { id: "indicacoes", label: "Indicação de amigos", Icon: LinkIcon },
  { id: "seguranca", label: "Segurança", Icon: LockIcon },
];

export function ContaSidebar({
  clientName,
  email,
  logoUrl,
  active,
  onSelect,
}: {
  clientName: string;
  email: string;
  logoUrl: string | null;
  active: ContaSection;
  onSelect: (section: ContaSection) => void;
}) {
  const initials = getInitials(clientName);
  const avatarColor = colorFromName(clientName);

  return (
    <div className="w-60 shrink-0">
      <div className="mb-6 flex flex-col items-start gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={clientName} className="h-20 w-20 rounded-full border border-border object-cover" />
        ) : (
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold text-white"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-card-foreground">{clientName}</p>
          <p className="truncate text-xs text-muted-foreground">{email || "..."}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex items-center gap-2.5 rounded-md border-l-2 py-2 pl-3 pr-2 text-left text-sm transition-colors ${
                isActive
                  ? "border-brand-primary bg-brand-primary/5 font-semibold text-brand-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-card-foreground"
              }`}
            >
              <Icon />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContaSidebar.tsx
git commit -m "feat(conta): sub-sidebar de navegação (identidade + 5 seções)"
```

---

## Task 4: Seção Perfil (`ContaPerfilSection`)

**Files:**
- Create: `src/components/ContaPerfilSection.tsx`

**Interfaces:**
- Consumes: `ContaField` de `./ContaField` (Task 2).
- Produces: componente `ContaPerfilSection({ clientName: string; contactEmail: string;
  onEmailChange: (value: string) => void; emailSaveStatus: "idle" | "saving" | "saved" |
  "error"; onSaveEmail: () => void; logoUrl: string | null; uploadStatus: "idle" | "saving" |
  "saved" | "error"; fileInputRef: RefObject<HTMLInputElement | null>; onLogoChange: (e:
  ChangeEvent<HTMLInputElement>) => void })`.

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/ContaPerfilSection.tsx
"use client";

import type { ChangeEvent, RefObject } from "react";
import { ContaField } from "./ContaField";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ContaPerfilSection({
  clientName,
  contactEmail,
  onEmailChange,
  emailSaveStatus,
  onSaveEmail,
  logoUrl,
  uploadStatus,
  fileInputRef,
  onLogoChange,
}: {
  clientName: string;
  contactEmail: string;
  onEmailChange: (value: string) => void;
  emailSaveStatus: SaveStatus;
  onSaveEmail: () => void;
  logoUrl: string | null;
  uploadStatus: SaveStatus;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onLogoChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const emailBadge =
    emailSaveStatus === "saved"
      ? { label: "Salvo", tone: "success" as const }
      : emailSaveStatus === "error"
        ? { label: "Erro ao salvar", tone: "warning" as const }
        : undefined;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Perfil</h2>
      <p className="mb-5 text-xs text-muted-foreground">Informações básicas da sua conta.</p>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Foto de perfil" className="h-28 w-28 rounded-full border border-border object-cover" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
              Sem foto
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadStatus === "saving"}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {uploadStatus === "saving" ? "Enviando..." : "Trocar foto"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={onLogoChange}
            className="hidden"
          />
          {uploadStatus === "error" && <p className="text-xs text-red-500">Não foi possível enviar.</p>}
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <ContaField label="Nome">{clientName}</ContaField>

          <div>
            <ContaField label="E-mail de contato" badge={emailBadge}>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-transparent text-sm font-medium text-card-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
            </ContaField>
            <button
              type="button"
              onClick={onSaveEmail}
              disabled={emailSaveStatus === "saving"}
              className="mt-2 rounded-md bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {emailSaveStatus === "saving" ? "Salvando..." : "Salvar e-mail"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContaPerfilSection.tsx
git commit -m "feat(conta): seção Perfil (avatar + nome + e-mail)"
```

---

## Task 5: Seção Fuso horário (`ContaFusoSection`)

**Files:**
- Create: `src/components/ContaFusoSection.tsx`

**Interfaces:**
- Consumes: `ContaField` de `./ContaField` (Task 2); `US_TIMEZONES` de `@/lib/clientTime`
  (já existe).
- Produces: componente `ContaFusoSection({ timeZone: string; onTimeZoneChange: (value: string)
  => void; saveStatus: "idle" | "saving" | "saved" | "error"; onSave: () => void })`.

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/ContaFusoSection.tsx
"use client";

import { US_TIMEZONES } from "@/lib/clientTime";
import { ContaField } from "./ContaField";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ContaFusoSection({
  timeZone,
  onTimeZoneChange,
  saveStatus,
  onSave,
}: {
  timeZone: string;
  onTimeZoneChange: (value: string) => void;
  saveStatus: SaveStatus;
  onSave: () => void;
}) {
  const badge =
    saveStatus === "saved"
      ? { label: "Salvo", tone: "success" as const }
      : saveStatus === "error"
        ? { label: "Erro ao salvar", tone: "warning" as const }
        : undefined;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Fuso horário</h2>
      <p className="mb-5 text-xs text-muted-foreground">Define o horário exibido no Calendário e nas Atas.</p>

      <div className="max-w-sm">
        <ContaField label="Fuso" badge={badge}>
          <select
            value={timeZone}
            onChange={(e) => onTimeZoneChange(e.target.value)}
            className="w-full bg-transparent text-sm font-medium text-card-foreground outline-none"
          >
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </ContaField>
        <button
          type="button"
          onClick={onSave}
          disabled={saveStatus === "saving"}
          className="mt-3 rounded-md bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
        >
          {saveStatus === "saving" ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContaFusoSection.tsx
git commit -m "feat(conta): seção Fuso horário"
```

---

## Task 6: Seção Faturamento (`ContaFaturamentoSection`)

**Files:**
- Create: `src/components/ContaFaturamentoSection.tsx`

**Interfaces:**
- Consumes: nada de outras tasks.
- Produces: tipo exportado `Payment = { id: string; paidAt: string; amount: number | null }`;
  componente `ContaFaturamentoSection({ planName: string | null; paymentStatus: string | null;
  contractDuration: string; payments: Payment[] })`.

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/ContaFaturamentoSection.tsx
"use client";

export type Payment = { id: string; paidAt: string; amount: number | null };

function paymentStatusTone(status: string): "success" | "warning" {
  return /atras|pend|falh/i.test(status) ? "warning" : "success";
}

export function ContaFaturamentoSection({
  planName,
  paymentStatus,
  contractDuration,
  payments,
}: {
  planName: string | null;
  paymentStatus: string | null;
  contractDuration: string;
  payments: Payment[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Faturamento</h2>
      <p className="mb-5 text-xs text-muted-foreground">Plano, pagamentos e tempo de contrato.</p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md bg-muted px-4 py-3">
          <p className="mb-1 text-xs text-muted-foreground">Plano</p>
          <p className="text-lg font-bold text-card-foreground">{planName ?? "Não configurado"}</p>
        </div>
        <div className="rounded-md bg-muted px-4 py-3">
          <p className="mb-1 text-xs text-muted-foreground">Status de pagamento</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-card-foreground">{paymentStatus ?? "Não configurado"}</p>
            {paymentStatus && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  paymentStatusTone(paymentStatus) === "success"
                    ? "bg-brand-success/10 text-brand-success"
                    : "bg-amber-500/10 text-amber-600"
                }`}
              >
                {paymentStatusTone(paymentStatus) === "success" ? "Em dia" : "Atenção"}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-md bg-muted px-4 py-3">
          <p className="mb-1 text-xs text-muted-foreground">Tempo de contrato</p>
          <p className="text-lg font-bold text-card-foreground">{contractDuration}</p>
        </div>
      </div>

      <p className="mb-2 text-xs font-semibold text-card-foreground">Histórico de pagamentos</p>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-card-foreground">{p.paidAt}</span>
              {p.amount != null && (
                <span className="font-medium tabular-nums text-card-foreground">R$ {p.amount.toFixed(2)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContaFaturamentoSection.tsx
git commit -m "feat(conta): seção Faturamento (blocos de destaque + histórico tabular)"
```

---

## Task 7: Seção Indicação de amigos (`ContaIndicacoesSection`)

**Files:**
- Create: `src/components/ContaIndicacoesSection.tsx`

**Interfaces:**
- Consumes: `ContaField` de `./ContaField` (Task 2).
- Produces: tipo exportado `ReferralLead = { id: string; name: string; contact: string;
  createdAt: string }`; componente `ContaIndicacoesSection({ referralLink: string; copyStatus:
  "idle" | "copied"; onCopy: () => void; referralLeads: ReferralLead[] })`.

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/ContaIndicacoesSection.tsx
"use client";

import { ContaField } from "./ContaField";

export type ReferralLead = { id: string; name: string; contact: string; createdAt: string };

export function ContaIndicacoesSection({
  referralLink,
  copyStatus,
  onCopy,
  referralLeads,
}: {
  referralLink: string;
  copyStatus: "idle" | "copied";
  onCopy: () => void;
  referralLeads: ReferralLead[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Indicação de amigos</h2>
      <p className="mb-5 text-xs text-muted-foreground">Compartilhe seu link e acompanhe quem você já indicou.</p>

      <div className="mb-6 flex items-end gap-2">
        <div className="flex-1">
          <ContaField label="Seu link de indicação">
            <span className="block truncate">{referralLink}</span>
          </ContaField>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted"
        >
          {copyStatus === "copied" ? "Copiado!" : "Copiar"}
        </button>
      </div>

      <p className="mb-2 text-xs font-semibold text-card-foreground">Quem você já indicou</p>
      {referralLeads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma indicação ainda.</p>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {referralLeads.map((lead) => (
            <div key={lead.id} className="grid grid-cols-3 gap-2 py-2.5 text-sm">
              <span className="truncate text-card-foreground">{lead.name}</span>
              <span className="truncate text-muted-foreground">{lead.contact}</span>
              <span className="text-right text-muted-foreground">{lead.createdAt.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContaIndicacoesSection.tsx
git commit -m "feat(conta): seção Indicação de amigos (link + lista tabular)"
```

---

## Task 8: Seção Segurança (`ContaSegurancaSection`)

**Files:**
- Create: `src/components/ContaSegurancaSection.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: componente `ContaSegurancaSection()` (sem props).

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/ContaSegurancaSection.tsx
export function ContaSegurancaSection() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Segurança</h2>
      <p className="text-sm text-muted-foreground">
        Login por e-mail e senha ainda não existe — está no roadmap. Por enquanto, o acesso à
        sua conta é feito pelo link único enviado a você pela Clique Boost, sem necessidade de
        senha.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContaSegurancaSection.tsx
git commit -m "feat(conta): seção Segurança (aviso de roadmap)"
```

---

## Task 9: Integrar tudo em `ContaPageClient`

**Files:**
- Modify: `src/components/ContaPageClient.tsx` (reescrita completa do arquivo)

**Interfaces:**
- Consumes: `ContaSidebar`/`ContaSection` (Task 3), `ContaPerfilSection` (Task 4),
  `ContaFusoSection` (Task 5), `ContaFaturamentoSection`/`Payment` (Task 6),
  `ContaIndicacoesSection`/`ReferralLead` (Task 7), `ContaSegurancaSection` (Task 8).
- Produces: nada consumido por outras tasks — é o topo da árvore desta feature.

- [ ] **Step 1: Substituir o conteúdo do arquivo**

Ler o arquivo atual primeiro (`src/components/ContaPageClient.tsx`) pra confirmar que o estado
e os handlers batem com o que está descrito abaixo (fetch inicial, `handleSaveTimeZone`,
`handleSaveEmail`, `handleLogoChange`, `handleCopyLink` — nenhum desses muda de lógica, só o
JSX renderizado no final do componente).

Substituir o arquivo inteiro por:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ContaSidebar, type ContaSection } from "./ContaSidebar";
import { ContaPerfilSection } from "./ContaPerfilSection";
import { ContaFusoSection } from "./ContaFusoSection";
import { ContaFaturamentoSection, type Payment } from "./ContaFaturamentoSection";
import { ContaIndicacoesSection, type ReferralLead } from "./ContaIndicacoesSection";
import { ContaSegurancaSection } from "./ContaSegurancaSection";

type Status = "loading" | "error" | "ready";
type SaveStatus = "idle" | "saving" | "saved" | "error";

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
  const [section, setSection] = useState<ContaSection>("perfil");

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

  const [referralLeads, setReferralLeads] = useState<ReferralLead[]>([]);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const referralLink = typeof window !== "undefined" ? `${window.location.origin}/r/${clientId}` : "";

  function handleCopyLink() {
    navigator.clipboard
      .writeText(referralLink)
      .then(() => {
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2000);
      })
      .catch(() => setCopyStatus("idle"));
  }

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
          referralLeads: ReferralLead[];
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
          setReferralLeads(data.referralLeads);
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
    <div className="mx-auto flex w-full max-w-[1600px] gap-8 px-6 pt-6 pb-10 sm:px-10">
      <ContaSidebar clientName={clientName} email={contactEmail} logoUrl={logoUrl} active={section} onSelect={setSection} />

      <div className="min-w-0 flex-1">
        {status === "loading" && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {status === "error" && (
          <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar as configurações agora.
          </p>
        )}
        {status === "ready" && (
          <>
            {section === "perfil" && (
              <ContaPerfilSection
                clientName={clientName}
                contactEmail={contactEmail}
                onEmailChange={(value) => {
                  setContactEmail(value);
                  setEmailSaveStatus("idle");
                }}
                emailSaveStatus={emailSaveStatus}
                onSaveEmail={handleSaveEmail}
                logoUrl={logoUrl}
                uploadStatus={uploadStatus}
                fileInputRef={fileInputRef}
                onLogoChange={handleLogoChange}
              />
            )}
            {section === "fuso" && (
              <ContaFusoSection
                timeZone={timeZone}
                onTimeZoneChange={(value) => {
                  setTimeZone(value);
                  setSaveStatus("idle");
                }}
                saveStatus={saveStatus}
                onSave={handleSaveTimeZone}
              />
            )}
            {section === "faturamento" && (
              <ContaFaturamentoSection
                planName={planName}
                paymentStatus={paymentStatus}
                contractDuration={contractDuration}
                payments={payments}
              />
            )}
            {section === "indicacoes" && (
              <ContaIndicacoesSection
                referralLink={referralLink}
                copyStatus={copyStatus}
                onCopy={handleCopyLink}
                referralLeads={referralLeads}
              />
            )}
            {section === "seguranca" && <ContaSegurancaSection />}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sem erros.

- [ ] **Step 3: Lint dos arquivos da feature**

Run: `npx eslint src/components/Conta*.tsx`
Expected: sem novos erros (podem aparecer os mesmos avisos pré-existentes de
`react-hooks/set-state-in-effect` que já existem em outros componentes da branch — não são
regressão desta task, não precisam ser corrigidos aqui).

- [ ] **Step 4: Build de produção**

Run: `npm run build`
Expected: build completa sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/ContaPageClient.tsx
git commit -m "feat(conta): integra sub-sidebar + 5 seções no ContaPageClient"
```

- [ ] **Step 6: Deploy de preview e checagem visual**

Run: `vercel deploy`

Abrir `/[client]/conta?key=...` no link do preview (client de teste: `debora`, token
`e5bff4d1825a067cfab62539526e9a3c`) e confirmar manualmente:
- Página usa a largura cheia, com sub-sidebar à esquerda (avatar/iniciais + nome + e-mail, 5
  itens de navegação) e conteúdo à direita.
- Clicar em cada um dos 5 itens troca o conteúdo sem reload, com o item ativo destacado
  (borda esquerda colorida + texto na cor da marca).
- Em Perfil: trocar a foto funciona (endpoint de upload já existente) e editar/salvar o
  e-mail mostra o badge "Salvo" e persiste ao recarregar a página.
- Em Fuso horário: trocar o fuso e salvar funciona, badge "Salvo" aparece.
- Em Faturamento: os 3 blocos de destaque aparecem, e o histórico de pagamentos (se o
  cliente de teste tiver dados) aparece em lista alinhada.
- Em Indicação de amigos: copiar o link funciona; lista de indicados (se houver) aparece em
  colunas alinhadas.
- Em Segurança: mostra só o aviso, sem campo nenhum.

---

## Self-Review

**Cobertura da spec:** as 8 seções da spec (`2026-08-05-conta-redesign-design.md`) têm task
correspondente — estrutura da página (Task 3 + 9), sistema visual de campos (Task 2), Perfil
(Task 4), Fuso horário (Task 5), Faturamento (Task 6), Indicação de amigos (Task 7), Segurança
(Task 8). Nenhum endpoint novo é criado (confirmado nas Global Constraints e em cada task —
todas reaproveitam as rotas existentes).

**Placeholders:** nenhum "TBD"/"implementar depois" — todo componente tem código completo.

**Consistência de tipos:** `ContaSection`, `Payment`, `ReferralLead`, `SaveStatus` e os nomes
de prop (`onEmailChange`, `onTimeZoneChange`, `onSaveEmail`, `onSave`, `onCopy`, `onSelect`,
`fileInputRef`, `onLogoChange`) são os mesmos entre a task que produz o componente e a Task 9
que o consome — conferido linha a linha ao montar a Task 9.
