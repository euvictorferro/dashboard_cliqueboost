# Sidebar — Card de Conta + Tema + Sair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O item "Conta" sai da lista de nav da sidebar e vira um card fixo no rodapé (avatar por iniciais + nome + e-mail), com dropdown de Tema (Claro/Escuro/Sistema)/Configurações/Sair; tema ganha um `ThemeProvider` próprio sem biblioteca nova.

**Architecture:** `ThemeProvider` (Context + localStorage) fica na raiz do app e expõe `useTheme()`. `AccountCard` é um componente novo, autossuficiente (resolve nome via `CLIENTS`, busca e-mail via a rota `/api/conta/[client]` que já existe), renderizado fixo no rodapé do `Sidebar`. `globals.css` ganha suporte a alternância manual de tema via classe (`.dark`/`.light`), complementando o `@media (prefers-color-scheme: dark)` que já existe (cobre a opção "Sistema").

**Tech Stack:** Next.js App Router, React Context, `localStorage`, Tailwind CSS v4 (`@custom-variant`), TypeScript.

## Global Constraints

- Sem biblioteca nova (nada de `next-themes` ou similar) — `ThemeProvider` é Context + `localStorage` puro.
- `Sidebar` continua recebendo só `clientId`/`accessKey` como hoje — nenhuma `page.tsx` que já usa `<Sidebar>` precisa ser modificada.
- E-mail do card de conta vem da rota `GET /api/conta/[client]` que já existe (campo `contactEmail` no payload) — nenhuma rota nova pra isso.
- `/sair` é uma página pública, fora da área autenticada (sem `verifyClientToken`) — é só uma tela informativa, não invalida nenhum token de verdade (não existe sessão real ainda).
- Avatar é sempre gerado por iniciais — sem upload, sem campo novo no banco.
- Preferência de tema fica só em `localStorage` (por navegador/dispositivo) — não persiste no Supabase.
- Verificação de cada task é `npx tsc --noEmit` limpo (o projeto não tem suíte de testes automatizados) + checagem visual manual descrita em cada task.

---

### Task 1: `ThemeProvider` + suporte a tema manual no `globals.css`

**Files:**
- Create: `src/components/ThemeProvider.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `useTheme(): { theme: "light" | "dark" | "system"; setTheme: (t: "light" | "dark" | "system") => void }`, exportado de `src/components/ThemeProvider.tsx`, junto com o componente `ThemeProvider`.

- [ ] **Step 1: Criar `src/components/ThemeProvider.tsx`**

```tsx
// src/components/ThemeProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme !== "system") root.classList.add(theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const initial: Theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
```

- [ ] **Step 2: Editar `src/app/globals.css`**

Arquivo atual completo (pra referência exata de onde editar):

```css
@import "tailwindcss";

:root {
  --background: 220 20% 97%;
  --foreground: 222 20% 14%;
  --card: 0 0% 100%;
  --card-foreground: 222 20% 14%;
  --border: 220 16% 91%;
  --muted: 220 16% 93%;
  --muted-foreground: 220 9% 46%;

  --brand-primary: 263 84% 52%;
  --brand-accent: 211 100% 50%;
  --brand-success: 163 100% 39%;
  --brand-danger: 4 90% 61%;
  --brand-track: 211 100% 92%;

  --radius: 0.875rem;
  --shadow-soft: 0 1px 2px hsl(220 20% 20% / 0.04), 0 8px 24px -12px hsl(220 20% 20% / 0.12);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 222 18% 9%;
    --foreground: 210 20% 95%;
    --card: 222 16% 13%;
    --card-foreground: 210 20% 95%;
    --border: 220 13% 20%;
    --muted: 220 13% 18%;
    --muted-foreground: 220 9% 64%;

    --brand-primary: 263 84% 65%;
    --brand-accent: 211 100% 60%;
    --brand-track: 211 40% 22%;
    --shadow-soft: 0 1px 2px hsl(0 0% 0% / 0.2), 0 8px 24px -12px hsl(0 0% 0% / 0.4);
  }
}
```

Troque exatamente esse trecho (do `@import` até o fechamento do `@media`) por:

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: 220 20% 97%;
  --foreground: 222 20% 14%;
  --card: 0 0% 100%;
  --card-foreground: 222 20% 14%;
  --border: 220 16% 91%;
  --muted: 220 16% 93%;
  --muted-foreground: 220 9% 46%;

  --brand-primary: 263 84% 52%;
  --brand-accent: 211 100% 50%;
  --brand-success: 163 100% 39%;
  --brand-danger: 4 90% 61%;
  --brand-track: 211 100% 92%;

  --radius: 0.875rem;
  --shadow-soft: 0 1px 2px hsl(220 20% 20% / 0.04), 0 8px 24px -12px hsl(220 20% 20% / 0.12);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 222 18% 9%;
    --foreground: 210 20% 95%;
    --card: 222 16% 13%;
    --card-foreground: 210 20% 95%;
    --border: 220 13% 20%;
    --muted: 220 13% 18%;
    --muted-foreground: 220 9% 64%;

    --brand-primary: 263 84% 65%;
    --brand-accent: 211 100% 60%;
    --brand-track: 211 40% 22%;
    --shadow-soft: 0 1px 2px hsl(0 0% 0% / 0.2), 0 8px 24px -12px hsl(0 0% 0% / 0.4);
  }
}

.dark {
  --background: 222 18% 9%;
  --foreground: 210 20% 95%;
  --card: 222 16% 13%;
  --card-foreground: 210 20% 95%;
  --border: 220 13% 20%;
  --muted: 220 13% 18%;
  --muted-foreground: 220 9% 64%;

  --brand-primary: 263 84% 65%;
  --brand-accent: 211 100% 60%;
  --brand-track: 211 40% 22%;
  --shadow-soft: 0 1px 2px hsl(0 0% 0% / 0.2), 0 8px 24px -12px hsl(0 0% 0% / 0.4);
}

.light {
  --background: 220 20% 97%;
  --foreground: 222 20% 14%;
  --card: 0 0% 100%;
  --card-foreground: 222 20% 14%;
  --border: 220 16% 91%;
  --muted: 220 16% 93%;
  --muted-foreground: 220 9% 46%;

  --brand-primary: 263 84% 52%;
  --brand-accent: 211 100% 50%;
  --brand-track: 211 100% 92%;
  --shadow-soft: 0 1px 2px hsl(220 20% 20% / 0.04), 0 8px 24px -12px hsl(220 20% 20% / 0.12);
}
```

(O resto do arquivo — `@theme inline { ... }` e `body { ... }` — fica exatamente como está, sem mudança.)

- [ ] **Step 3: Editar `src/app/layout.tsx`**

Arquivo atual completo:

```tsx
import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Dashboard Clique Boost",
  description: "Métricas de Meta, Instagram, TikTok e tráfego pago dos clientes Clique Boost",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

Troque por:

```tsx
import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Dashboard Clique Boost",
  description: "Métricas de Meta, Instagram, TikTok e tráfego pago dos clientes Clique Boost",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos (ignore ruído pré-existente de `.next/dev/types/validator.ts` sobre `/api/zzdebug`, não relacionado).

- [ ] **Step 5: Commit**

```bash
git add src/components/ThemeProvider.tsx src/app/globals.css src/app/layout.tsx
git commit -m "feat: ThemeProvider (Claro/Escuro/Sistema) sem biblioteca nova"
```

---

### Task 2: Página `/sair`

**Files:**
- Create: `src/app/sair/page.tsx`

**Interfaces:**
- Consumes: `Logo` de `src/components/Logo.tsx` (já existe).

- [ ] **Step 1: Criar `src/app/sair/page.tsx`**

```tsx
// src/app/sair/page.tsx
import { Logo } from "@/components/Logo";

export default function SairPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Logo />
      <h1 className="text-xl font-semibold text-foreground">Você saiu</h1>
      <p className="text-sm text-muted-foreground">Peça um novo link de acesso à Clique Boost pra entrar de novo.</p>
    </div>
  );
}
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/app/sair/
git commit -m "feat: página /sair (tela informativa, sem login real ainda)"
```

---

### Task 3: `AccountCard`

**Files:**
- Create: `src/components/AccountCard.tsx`

**Interfaces:**
- Consumes: `CLIENTS` de `src/lib/clients.ts` (já existe, campo `name`); `useTheme` de `src/components/ThemeProvider.tsx` (Task 1); `GET /api/conta/[client]` (já existe, retorna `{ contactEmail: string | null, ... }`).
- Produces: `AccountCard({ clientId, accessKey }: { clientId: string; accessKey: string })`, usado pelo `Sidebar` na Task 4.

- [ ] **Step 1: Criar `src/components/AccountCard.tsx`**

```tsx
// src/components/AccountCard.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CLIENTS } from "@/lib/clients";
import { useTheme } from "./ThemeProvider";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

const THEME_LABELS = { light: "Claro", dark: "Escuro", system: "Sistema" } as const;

export function AccountCard({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const client = CLIENTS.find((c) => c.id === clientId);
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      .then((data) => setEmail(typeof data.contactEmail === "string" ? data.contactEmail : null))
      .catch(() => setEmail(null));
  }, [clientId, accessKey]);

  if (!client) return null;

  const initials = getInitials(client.name);
  const avatarColor = colorFromName(client.name);

  return (
    <div className="relative border-t border-border pt-3">
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-full rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-soft)]">
          {!themeMenuOpen && (
            <>
              <button
                type="button"
                onClick={() => setThemeMenuOpen(true)}
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-card-foreground hover:bg-muted"
              >
                Tema
              </button>
              <Link
                href={`/${clientId}/conta?key=${encodeURIComponent(accessKey)}`}
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-card-foreground hover:bg-muted"
              >
                Configurações
              </Link>
              <Link href="/sair" className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-card-foreground hover:bg-muted">
                Sair
              </Link>
            </>
          )}
          {themeMenuOpen && (
            <>
              <button
                type="button"
                onClick={() => setThemeMenuOpen(false)}
                className="mb-1 flex w-full items-center rounded-md px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
              >
                ← Voltar
              </button>
              {(Object.keys(THEME_LABELS) as Array<keyof typeof THEME_LABELS>).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                    theme === t ? "text-brand-primary" : "text-card-foreground"
                  }`}
                >
                  {THEME_LABELS[t]}
                  {theme === t && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setThemeMenuOpen(false);
        }}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-card-foreground">{client.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{email ?? "..."}</span>
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/components/AccountCard.tsx
git commit -m "feat: componente AccountCard (avatar, nome, e-mail, dropdown Tema/Configurações/Sair)"
```

---

### Task 4: Sidebar — remove Conta da lista, adiciona `AccountCard` fixo no rodapé

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `AccountCard` de `src/components/AccountCard.tsx` (Task 3).

- [ ] **Step 1: Editar `src/components/Sidebar.tsx`**

Remova a função `ContaIcon` (não é mais usada em lugar nenhum depois desta mudança):

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

Adicione o import do `AccountCard` junto dos outros imports do topo:

```tsx
import { AccountCard } from "./AccountCard";
```

Troque:

```tsx
const ITEMS_AFTER_SOCIAL: NavItemDef[] = [
  { href: "/atas", label: "Atas", key: "atas", icon: AtasIcon },
  { href: "/booster-ai", label: "Booster AI", key: "booster-ai", icon: BoosterAiIcon },
  { href: "/conta", label: "Conta", key: "conta", icon: ContaIcon },
];
```

por:

```tsx
const ITEMS_AFTER_SOCIAL: NavItemDef[] = [
  { href: "/atas", label: "Atas", key: "atas", icon: AtasIcon },
  { href: "/booster-ai", label: "Booster AI", key: "booster-ai", icon: BoosterAiIcon },
];
```

Troque todo o `return (...)` do componente `Sidebar`, de:

```tsx
  return (
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-card px-4 py-6">
      <div className="px-2">
        <Logo />
      </div>

      <div>
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Menu</p>
        <div className="flex flex-col gap-1">
          {ITEMS_BEFORE_SOCIAL.map((item) => (
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

          {ITEMS_AFTER_SOCIAL.map((item) => (
            <NavLink key={item.href} clientId={clientId} accessKey={accessKey} item={item} isActive={active === item.key} />
          ))}
        </div>
      </div>
    </nav>
  );
```

para:

```tsx
  return (
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
        <div className="px-2">
          <Logo />
        </div>

        <div>
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Menu</p>
          <div className="flex flex-col gap-1">
            {ITEMS_BEFORE_SOCIAL.map((item) => (
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

            {ITEMS_AFTER_SOCIAL.map((item) => (
              <NavLink key={item.href} clientId={clientId} accessKey={accessKey} item={item} isActive={active === item.key} />
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <AccountCard clientId={clientId} accessKey={accessKey} />
      </div>
    </nav>
  );
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Rodar `npm run build` (checagem final de todo o plano)**

Run: `npm run build`
Expected: build limpo, sem erros de tipo ou de rota.

- [ ] **Step 4: Verificação manual no navegador**

Abrir `http://localhost:3000/debora?key=<token_real>` e confirmar:
- "Conta" não aparece mais na lista de itens do menu.
- Card fixo no rodapé da sidebar mostra iniciais + nome real do cliente + e-mail (ou "..." enquanto carrega).
- Clicar no card abre o dropdown com Tema/Configurações/Sair.
- Clicar em "Tema" mostra Claro/Escuro/Sistema; escolher "Escuro" muda a interface pra escuro de verdade; recarregar a página mantém a escolha.
- Clicar em "Configurações" abre `/debora/conta?key=...` normalmente.
- Clicar em "Sair" abre `/sair` com a mensagem informativa.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: Sidebar - remove Conta da lista, adiciona AccountCard fixo no rodapé"
```
