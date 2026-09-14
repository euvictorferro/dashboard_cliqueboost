# Shell Mobile (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abaixo de 768px o app troca a sidebar de desktop por um header fixo em cima + tab bar fixa embaixo (estilo Instagram), sem cortar nada nas bordas do iPhone; acima de 768px nada muda.

**Architecture:** Um breakpoint só (`md`, Tailwind), resolvido 100% em CSS — os dois shells (desktop e mobile) coexistem no JSX de `AppFrame`, alternando com `hidden md:flex` / `flex md:hidden`. Dois componentes novos (`MobileHeader`, `BottomTabBar`) reaproveitam ícones e o tipo `ActiveKey` que já existem em `Sidebar.tsx`.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind CSS v4 (config via `globals.css`, sem `tailwind.config.*`), TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-14-mobile-shell-design.md`

## Global Constraints

- Breakpoint único: `md` = 768px (padrão Tailwind), sem detecção de user-agent.
- Acima de `md`: zero mudança visual/comportamental no shell atual (`Sidebar.tsx`, `Header.tsx` intocados no conteúdo, só ganham classe `hidden md:flex`).
- Nenhum elemento do shell mobile pode renderizar atrás do notch/Dynamic Island (topo) ou da home indicator (embaixo) — usar `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`.
- Nenhuma página interna (Dashboard, Conteúdos, Tasks, Calendário, Booster AI, Atas, Bunker) é tocada nesta fase — só o shell.
- Bunker some da navegação em produção (mesma regra que já existe hoje em `Sidebar.tsx` via `isProductionEnv()`).

---

### Task 1: Habilitar `env(safe-area-inset-*)` via viewport-fit=cover

O Next.js só expõe as variáveis CSS `env(safe-area-inset-*)` quando a tag
`<meta name="viewport">` tem `viewport-fit=cover`. Sem isso, todo o resto do
plano (paddings de safe-area) não tem efeito nenhum no iPhone — é pré-requisito
de tudo mais.

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: nenhuma API nova — só habilita `env(safe-area-inset-top/bottom)` pro resto do CSS do app.

- [ ] **Step 1: Adicionar o export `viewport` no root layout**

Abra `src/app/layout.tsx`. Junto ao `import type { Metadata }` já existente,
importe também `Viewport`, e adicione o export logo abaixo de `export const
metadata`:

```tsx
import type { Metadata, Viewport } from "next";
```

```tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
```

- [ ] **Step 2: Verificar que renderizou certo**

Rode `npm run dev`, abra `http://localhost:3000` (qualquer rota), view-source
ou inspecione o `<head>` — deve ter
`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.

Expected: a tag aparece com `viewport-fit=cover` no `content`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/app/layout.tsx
git commit -m "feat(mobile): habilita viewport-fit=cover pro safe-area funcionar"
```

---

### Task 2: Criar `BottomTabBar.tsx`

**Files:**
- Create: `src/components/layout/BottomTabBar.tsx`

**Interfaces:**
- Consumes: `ActiveKey` (tipo já exportado por `src/components/layout/Sidebar.tsx`).
- Produces: `export function BottomTabBar({ clientId, active }: { clientId: string; active: ActiveKey })` — componente client, sem estado próprio, só navegação via `Link` do Next.

- [ ] **Step 1: Criar o arquivo com os 5 itens e o ícone de Conta**

```tsx
// src/components/layout/BottomTabBar.tsx
"use client";

import Link from "next/link";
import type { ActiveKey } from "@/components/layout/Sidebar";

function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="4" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7" y="2" width="4" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="2" width="4" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="2" width="13" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 8.5l1.7 1.7L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7h14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 2v3M12.5 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ContaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 15c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type TabDef = { href: string; label: string; key: ActiveKey; icon: () => React.JSX.Element };

const TABS: TabDef[] = [
  { href: "", label: "Dashboard", key: "dashboard", icon: DashboardIcon },
  { href: "/conteudos", label: "Conteúdos", key: "conteudos", icon: ContentIcon },
  { href: "/tasks", label: "Tarefas", key: "tasks", icon: TasksIcon },
  { href: "/calendario", label: "Calendário", key: "calendario", icon: CalendarIcon },
  { href: "/conta", label: "Conta", key: "conta", icon: ContaIcon },
];

export function BottomTabBar({ clientId, active }: { clientId: string; active: ActiveKey }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/${clientId}${tab.href}`}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Rode `npx tsc --noEmit` na raiz do projeto.

Expected: sem erros novos relacionados a `BottomTabBar.tsx` (erros pré-existentes
em outros arquivos, se houver, não fazem parte desta task).

- [ ] **Step 3: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/layout/BottomTabBar.tsx
git commit -m "feat(mobile): cria BottomTabBar com as 5 abas principais"
```

---

### Task 3: Criar `MobileHeader.tsx`

**Files:**
- Create: `src/components/layout/MobileHeader.tsx`

**Interfaces:**
- Produces: `export function MobileHeader({ pageLabel }: { pageLabel: string })`.

- [ ] **Step 1: Criar o arquivo**

```tsx
// src/components/layout/MobileHeader.tsx
export function MobileHeader({ pageLabel }: { pageLabel: string }) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-20 flex h-[52px] items-center border-b border-border bg-card px-4"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <p className="text-sm font-medium text-card-foreground">{pageLabel}</p>
    </header>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Rode `npx tsc --noEmit`.

Expected: sem erros novos relacionados a `MobileHeader.tsx`.

- [ ] **Step 3: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/layout/MobileHeader.tsx
git commit -m "feat(mobile): cria MobileHeader fixo com safe-area do topo"
```

---

### Task 4: Ligar os dois shells em `AppFrame.tsx`

Esta é a task que efetivamente troca o layout no mobile. `Sidebar`/`Header`
atuais só ganham `hidden md:flex` — zero mudança de conteúdo neles.

**Files:**
- Modify: `src/components/layout/AppFrame.tsx:81-107` (o `return` do componente)

**Interfaces:**
- Consumes: `BottomTabBar` (Task 2), `MobileHeader` (Task 3), `Sidebar`/`Header` (já existentes, sem mudança de props).

- [ ] **Step 1: Importar os componentes novos**

No topo de `AppFrame.tsx`, junto aos imports existentes, adicione:

```tsx
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { MobileHeader } from "@/components/layout/MobileHeader";
```

- [ ] **Step 2: Trocar o `return` do componente**

Localize este bloco (linhas 81-107 do arquivo atual):

```tsx
  return (
    <div className="flex min-h-full items-start">
      <div className={`flex min-h-full flex-1 items-start ${mustResetCredentials ? "pointer-events-none blur-sm" : ""}`}>
        <Sidebar clientId={clientId} active={active} pageLabel={pageLabel} collapsed={collapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            clientName={client?.name ?? clientId}
            pageLabel={pageLabel}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((c) => !c)}
          />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
      <CmdK clientId={clientId} />
      {active !== "booster-ai" && !mustResetCredentials && <BoosterAiWidget clientId={clientId} />}
      {!mustResetCredentials && hasSeenOnboarding !== null && (
        <OnboardingTour clientId={clientId} active={active} hasSeenOnboarding={hasSeenOnboarding} />
      )}
      {mustResetCredentials && <UpdateCredentialsModal onDone={() => setMustResetCredentials(false)} />}
      {pendingMonthRef && (
        <RatingPopup
          clientId={clientId}
          monthRef={pendingMonthRef}
          dismissCount={dismissCount}
          onClose={handleDismiss}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
```

Substitua pelo bloco abaixo — mesma estrutura, só o miolo do primeiro `<div>`
vira dois blocos alternados por breakpoint:

```tsx
  return (
    <div className="flex min-h-full items-start">
      <div className={`flex min-h-full w-full flex-1 items-start ${mustResetCredentials ? "pointer-events-none blur-sm" : ""}`}>
        {/* Desktop: sidebar + header, exatamente como antes */}
        <div className="hidden md:flex md:min-h-full md:flex-1 md:items-start">
          <Sidebar clientId={clientId} active={active} pageLabel={pageLabel} collapsed={collapsed} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header
              clientName={client?.name ?? clientId}
              pageLabel={pageLabel}
              collapsed={collapsed}
              onToggleCollapse={() => setCollapsed((c) => !c)}
            />
            <div className="min-w-0">{children}</div>
          </div>
        </div>

        {/* Mobile: header fixo em cima + tab bar fixa embaixo, tipo Instagram */}
        <div className="flex min-h-full w-full flex-col md:hidden">
          <MobileHeader pageLabel={pageLabel} />
          <main
            className="min-w-0 flex-1 pt-[52px]"
            style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom))" }}
          >
            {children}
          </main>
          <BottomTabBar clientId={clientId} active={active} />
        </div>
      </div>
      <CmdK clientId={clientId} />
      {active !== "booster-ai" && !mustResetCredentials && <BoosterAiWidget clientId={clientId} />}
      {!mustResetCredentials && hasSeenOnboarding !== null && (
        <OnboardingTour clientId={clientId} active={active} hasSeenOnboarding={hasSeenOnboarding} />
      )}
      {mustResetCredentials && <UpdateCredentialsModal onDone={() => setMustResetCredentials(false)} />}
      {pendingMonthRef && (
        <RatingPopup
          clientId={clientId}
          monthRef={pendingMonthRef}
          dismissCount={dismissCount}
          onClose={handleDismiss}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
```

Nota: `pt-[52px]` no `<main>` compensa o `MobileHeader` fixo (mesma altura,
`h-[52px]`); o `paddingBottom` compensa a `BottomTabBar` (56px ≈ altura real
do ícone 20px + label + `py-2` + folga) mais a safe-area. `children` é
renderizado duas vezes no JSX (uma por shell) — React só monta o bloco
visível via CSS `hidden`/`md:hidden`, mas ambos existem no DOM; isso é
esperado e documentado no spec (seção "Riscos").

- [ ] **Step 3: Rodar o build**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
npm run build
```

Expected: build passa sem erros de tipo/lint relacionados a `AppFrame.tsx`.

- [ ] **Step 4: Verificar visualmente no simulador**

No Xcode/simulador iPhone 17, abra o app, faça login, olhe a tela de
Dashboard:
- Tab bar aparece fixa embaixo, com os 5 itens, sem cobrir a home indicator.
- Header aparece fixo em cima, sem sobrepor o notch/Dynamic Island.
- O conteúdo da página rola por baixo do header e por cima da tab bar, sem
  nenhum pedaço do conteúdo escondido atrás de nenhum dos dois.
- Navegar entre Dashboard / Conteúdos / Tarefas / Calendário / Conta pela
  tab bar funciona e o item ativo fica destacado.

Expected: os 4 pontos acima batem. Se algo estiver cortado, ajustar os
valores de `pt-[52px]` / `56px` no Step 2 antes de prosseguir.

- [ ] **Step 5: Verificar que o desktop não mudou**

Abra a mesma URL num navegador desktop (ou redimensione a janela do
simulador de Safari acima de 768px). A sidebar e o header devem estar
idênticos a como estavam antes desta fase.

Expected: nenhuma diferença visual no desktop.

- [ ] **Step 6: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/layout/AppFrame.tsx
git commit -m "feat(mobile): AppFrame alterna sidebar desktop / tab bar mobile por breakpoint"
```

---

### Task 5: Links de Atas/Bunker dentro de Conta (mobile)

Atas e Bunker não têm aba própria na tab bar (só 5 vagas). Esta task
adiciona uma seção só-mobile na página Conta com links de texto simples pra
essas duas páginas, pra não ficarem inacessíveis no app.

**Files:**
- Create: `src/components/conta/ContaMobileLinks.tsx`
- Modify: `src/components/conta/ContaPageClient.tsx`

**Interfaces:**
- Produces: `export function ContaMobileLinks({ clientId }: { clientId: string })`.
- Consumes: `isProductionEnv` de `@/lib/env` (já usado em `Sidebar.tsx` pra esconder o Bunker em produção).

- [ ] **Step 1: Criar `ContaMobileLinks.tsx`**

```tsx
// src/components/conta/ContaMobileLinks.tsx
import Link from "next/link";
import { isProductionEnv } from "@/lib/env";

export function ContaMobileLinks({ clientId }: { clientId: string }) {
  return (
    <section id="mais" className="md:hidden">
      <h2 className="mb-3 text-sm font-semibold text-card-foreground">Mais</h2>
      <div className="flex flex-col divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
        <Link href={`/${clientId}/atas`} className="px-4 py-3 text-sm text-card-foreground">
          Atas
        </Link>
        {!isProductionEnv() && (
          <Link href={`/${clientId}/bunker`} className="px-4 py-3 text-sm text-card-foreground">
            Bunker
          </Link>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Renderizar dentro de `ContaPageClient.tsx`**

Abra `src/components/conta/ContaPageClient.tsx`. Adicione o import junto aos
outros:

```tsx
import { ContaMobileLinks } from "@/components/conta/ContaMobileLinks";
```

Localize a seção `<section id="seguranca">` (é a última seção, logo antes
do fechamento `</div>` que fecha o bloco condicional de `status === "ready"`)
e adicione `ContaMobileLinks` logo depois dela:

```tsx
            <section id="seguranca">
              <ContaSegurancaSection />
            </section>
            <ContaMobileLinks clientId={clientId} />
          </div>
        )}
```

(As duas últimas linhas — `</div>` e `)}` — já existem no arquivo; só
inserimos `<ContaMobileLinks clientId={clientId} />` entre a seção de
segurança e o `</div>` de fechamento.)

- [ ] **Step 3: Verificar que compila**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
npx tsc --noEmit
```

Expected: sem erros novos relacionados a `ContaMobileLinks.tsx` ou
`ContaPageClient.tsx`.

- [ ] **Step 4: Verificar visualmente no simulador**

Na aba Conta do app (mobile), rolar até o fim da página — deve aparecer a
seção "Mais" com o link "Atas" (e "Bunker" só se não for build de produção),
dentro da área de scroll, sem ficar atrás da tab bar.

Expected: seção visível, links clicáveis, navegam pra `/atas` e `/bunker`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost"
git add src/components/conta/ContaMobileLinks.tsx src/components/conta/ContaPageClient.tsx
git commit -m "feat(mobile): adiciona acesso a Atas/Bunker via Conta no mobile"
```

---

## Verificação final (spec completo)

- [ ] Rodar `npm run build` uma última vez do zero (todas as tasks juntas) e confirmar que não há erros.
- [ ] No simulador: navegar as 5 abas, abrir Conta e confirmar os links de Atas/Bunker, girar pra paisagem e checar que a tab bar/header ainda respeitam a safe-area (não é requisito obrigatório da spec, mas vale checar já que é grátis).
- [ ] No desktop (janela ≥768px): confirmar que sidebar/header estão pixel-a-pixel iguais ao commit anterior à Task 1 (comparar com `git stash` / branch anterior se houver dúvida).
