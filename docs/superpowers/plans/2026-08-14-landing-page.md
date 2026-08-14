# Landing Page pública (cliqueboost.io) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public marketing landing page at `src/app/page.tsx` that sells Clique Boost's Marketing 360 agency services (not the client dashboard app) to U.S. real estate / insurance / financial brokers, bilingual (EN/PT toggle), matching the existing Tailwind design tokens.

**Architecture:** One page (`src/app/page.tsx`) composed of section components under `src/components/landing/`, each pulling copy from a single bilingual dictionary (`src/lib/landingCopy.ts`) via a client-side `LanguageProvider` context (toggle persisted to `localStorage`, no routing change, no i18n library). The application form is UI-only in this phase — no backend submission (see spec's "Fora de escopo").

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4 (existing tokens in `globals.css`), no new dependencies.

## Global Constraints

- Copy is bilingual EN/PT via header toggle, not separate routes (spec: "Bilíngue via toggle EN/PT no header").
- The landing sells **agency services (Marketing 360)**, not the app. The dashboard only appears once, as a "we build our own tech" proof point (spec section 7), never as the main offer.
- Reuse existing design tokens (`--color-brand-primary`, `--color-brand-accent`, `--radius-card`, `--shadow-soft`, `font-display`/`font-sans`) from `src/app/globals.css` — no new design system.
- No new dependencies; no test framework introduced (project has none — YAGNI per spec).
- Application form has **no real submission** in this phase — client-side only confirmation, no network call (spec: "Fora de escopo... Backend do formulário").
- One component per section under `src/components/landing/`, matching the project's "pasta por página/funcionalidade" convention.

---

## File Structure

- Create: `src/lib/landingCopy.ts` — bilingual copy dictionary + types
- Create: `src/components/landing/LanguageProvider.tsx` — client context (locale state + toggle, localStorage)
- Create: `src/components/landing/Header.tsx`
- Create: `src/components/landing/Hero.tsx`
- Create: `src/components/landing/PainPoints.tsx`
- Create: `src/components/landing/Promise.tsx`
- Create: `src/components/landing/Services.tsx`
- Create: `src/components/landing/Process.tsx`
- Create: `src/components/landing/Testimonials.tsx`
- Create: `src/components/landing/TechDifferentiator.tsx`
- Create: `src/components/landing/Faq.tsx`
- Create: `src/components/landing/ApplicationForm.tsx`
- Create: `src/components/landing/Footer.tsx`
- Create: `src/app/internal/page.tsx` — relocated internal client index (was `src/app/page.tsx`)
- Modify: `src/app/page.tsx` — becomes the public landing page

---

### Task 1: Bilingual copy dictionary + language context

**Files:**
- Create: `src/lib/landingCopy.ts`
- Create: `src/components/landing/LanguageProvider.tsx`

**Interfaces:**
- Produces: `type Locale = "en" | "pt"`, `type LandingCopy` (full shape below), `landingCopy: Record<Locale, LandingCopy>` from `src/lib/landingCopy.ts`.
- Produces: `LanguageProvider` (wraps children), `useLanguage(): { locale: Locale; toggleLocale: () => void }`, `useLandingCopy(): LandingCopy` from `src/components/landing/LanguageProvider.tsx`. Both hooks throw a clear error if used outside `LanguageProvider`.

- [ ] **Step 1: Write `src/lib/landingCopy.ts`**

```ts
// src/lib/landingCopy.ts
// Bilingual copy for the public landing page. One dictionary, two locales — no i18n library
// (single page, no routing split needed; see docs/superpowers/specs/2026-08-14-landing-page-design.md).

export type Locale = "en" | "pt";

export type LandingCopy = {
  header: { navCta: string; toggleLabel: string };
  hero: { eyebrow: string; headline: string; subheadline: string; cta: string };
  painPoints: {
    title: string;
    items: { title: string; body: string }[];
    closing: string;
  };
  promise: { headline: string; body: string };
  services: {
    title: string;
    subtitle: string;
    items: { title: string; body: string }[];
    aiNote: string;
  };
  process: { title: string; steps: { title: string; body: string }[] };
  testimonials: { title: string; subtitle: string };
  tech: { title: string; body: string };
  faq: { title: string; items: { q: string; a: string }[] };
  form: {
    title: string;
    subtitle: string;
    nameLabel: string;
    nicheLabel: string;
    nicheOptions: string[];
    marketLabel: string;
    painLabel: string;
    submit: string;
    successMessage: string;
  };
  footer: { tagline: string; contactLabel: string; rights: string };
};

export const landingCopy: Record<Locale, LandingCopy> = {
  en: {
    header: { navCta: "Apply Now", toggleLabel: "PT" },
    hero: {
      eyebrow: "Marketing Agency for Brokers",
      headline: "You close deals. We build the brand that gets you the calls.",
      subheadline:
        "Clique Boost runs the marketing engine behind top real estate and insurance brokers in the U.S. — content, ads, design, and strategy — so leads show up before you even open your laptop.",
      cta: "Apply to Work With Us",
    },
    painPoints: {
      title: "Sound familiar?",
      items: [
        {
          title: "Your Instagram hasn't grown in months",
          body: "Clients Google you before they call you — and what they find looks abandoned.",
        },
        {
          title: "You don't have time to be a marketer too",
          body: "You're closing deals, not editing reels and writing captions at midnight.",
        },
        {
          title: "Referrals alone aren't enough anymore",
          body: "Without consistent visibility, your pipeline depends entirely on who remembers to call you.",
        },
      ],
      closing: "None of that is a talent problem. It's a marketing problem — and it's fixable.",
    },
    promise: {
      headline: "You sell. You film. We handle everything else.",
      body: "Clique Boost is a full-service marketing team built specifically for brokers — real estate, insurance, and financial professionals who need a brand that works while they're closing deals.",
    },
    services: {
      title: "Everything your brand needs, handled",
      subtitle: "One team, one retainer, zero juggling freelancers.",
      items: [
        { title: "Website Design", body: "A site built to convert visitors into leads, not just look nice." },
        { title: "Social Media Strategy", body: "A content calendar and positioning built around your niche and market." },
        { title: "Viral Content Creation", body: "Short-form content designed to actually get seen — and remembered." },
        {
          title: "Paid Traffic (Multi-Platform)",
          body: "Meta, Google, LinkedIn, Pinterest, and X Ads — leads on the platforms where your clients already are.",
        },
        { title: "Video Editing", body: "Professional-grade edits from your raw footage — ready to post." },
        { title: "Post Design", body: "Branded graphics that make every post look like it came from a real agency." },
        { title: "Copywriting", body: "Captions and ad copy written to convert, not just fill space." },
      ],
      aiNote: "Need to automate client intake or internal workflows with AI? We build that too — on request.",
    },
    process: {
      title: "How it works",
      steps: [
        { title: "Apply", body: "Tell us about your market and where you're stuck." },
        { title: "Strategy Call", body: "We map out what your brand actually needs — no generic package." },
        { title: "Onboarding", body: "We set up your content system, ad accounts, and calendar." },
        { title: "Content & Leads Start Flowing", body: "You keep selling. We keep producing and running traffic." },
      ],
    },
    testimonials: {
      title: "Trusted by brokers who'd rather sell than post",
      subtitle: "A few of the professionals we work with.",
    },
    tech: {
      title: "Built with our own technology",
      body: "Every Clique Boost client gets access to a private dashboard — real Instagram metrics, content calendar, tasks, and reporting in one place. It's proof we don't just talk about marketing — we build the systems for it.",
    },
    faq: {
      title: "Questions, answered",
      items: [
        {
          q: "How much does this cost?",
          a: "Marketing 360 is a monthly retainer scoped to your market and goals — we'll walk you through pricing on the strategy call.",
        },
        {
          q: "Is there a contract?",
          a: "We work on a month-to-month basis after the initial onboarding period — no long lock-in.",
        },
        {
          q: "How fast will I see results?",
          a: "Content and brand consistency show up in weeks; paid traffic leads typically start within the first 30 days.",
        },
        {
          q: "Do you only work with real estate and insurance?",
          a: "We specialize in brokers and financial professionals — real estate, life insurance, and related financial services.",
        },
        {
          q: "Do I need to film my own content?",
          a: "Yes — you're the face of your brand. We handle editing, strategy, and everything around it.",
        },
      ],
    },
    form: {
      title: "Ready to stop chasing leads?",
      subtitle: "Apply below — we review every application personally.",
      nameLabel: "Full name",
      nicheLabel: "Your niche",
      nicheOptions: ["Real Estate", "Insurance", "Other financial services"],
      marketLabel: "Where do you work? (city/state)",
      painLabel: "What's your biggest challenge right now?",
      submit: "Submit Application",
      successMessage: "Thanks — we received your application and will reach out shortly.",
    },
    footer: {
      tagline: "Marketing 360 for brokers who'd rather sell than post.",
      contactLabel: "Contact",
      rights: "All rights reserved.",
    },
  },
  pt: {
    header: { navCta: "Aplicar Agora", toggleLabel: "EN" },
    hero: {
      eyebrow: "Agência de Marketing para Corretores",
      headline: "Você fecha negócios. A gente constrói a marca que traz as ligações.",
      subheadline:
        "A Clique Boost roda o motor de marketing por trás dos principais corretores de imóveis e seguros dos EUA — conteúdo, anúncios, design e estratégia — pra leads aparecerem antes de você nem abrir o notebook.",
      cta: "Aplicar Para Trabalhar Com a Gente",
    },
    painPoints: {
      title: "Isso parece familiar?",
      items: [
        {
          title: "Seu Instagram não cresce há meses",
          body: "Clientes te procuram no Google antes de ligar — e o que encontram parece abandonado.",
        },
        {
          title: "Você não tem tempo pra também ser marketeiro",
          body: "Você deveria estar fechando negócios, não editando reels e escrevendo legenda de madrugada.",
        },
        {
          title: "Só indicação não é mais suficiente",
          body: "Sem visibilidade constante, seu pipeline depende inteiramente de quem lembra de te ligar.",
        },
      ],
      closing: "Nada disso é falta de talento. É um problema de marketing — e tem solução.",
    },
    promise: {
      headline: "Você vende. Você grava. A gente cuida do resto.",
      body: "A Clique Boost é um time de marketing completo, feito especificamente pra corretores — de imóveis, seguros e profissionais financeiros que precisam de uma marca que trabalha enquanto eles fecham negócios.",
    },
    services: {
      title: "Tudo que sua marca precisa, resolvido",
      subtitle: "Um time, um contrato, zero freelancer pra gerenciar.",
      items: [
        { title: "Criação de Site", body: "Um site feito pra converter visitante em lead, não só bonito." },
        { title: "Estratégia de Redes Sociais", body: "Calendário de conteúdo e posicionamento construídos em volta do seu nicho e mercado." },
        { title: "Conteúdo Viral", body: "Conteúdo em formato curto feito pra realmente ser visto — e lembrado." },
        {
          title: "Tráfego Pago (Multi-Plataforma)",
          body: "Meta, Google, LinkedIn, Pinterest e X Ads — leads nas plataformas onde seus clientes já estão.",
        },
        { title: "Edição de Vídeo", body: "Edições de nível profissional a partir do seu material bruto — prontas pra postar." },
        { title: "Design de Posts", body: "Peças com identidade que fazem cada post parecer que veio de uma agência de verdade." },
        { title: "Copywriting", body: "Legendas e textos de anúncio escritos pra converter, não só preencher espaço." },
      ],
      aiNote: "Precisa automatizar atendimento ou fluxos internos com IA? A gente também faz — sob consulta.",
    },
    process: {
      title: "Como funciona",
      steps: [
        { title: "Aplique", body: "Conte pra gente sobre seu mercado e onde você está travado." },
        { title: "Chamada de Estratégia", body: "A gente mapeia o que sua marca realmente precisa — sem pacote genérico." },
        { title: "Onboarding", body: "A gente configura seu sistema de conteúdo, contas de anúncio e calendário." },
        { title: "Conteúdo e Leads Começam a Rodar", body: "Você continua vendendo. A gente continua produzindo e rodando tráfego." },
      ],
    },
    testimonials: {
      title: "Confiado por corretores que preferem vender a postar",
      subtitle: "Alguns dos profissionais com quem trabalhamos.",
    },
    tech: {
      title: "Construído com tecnologia própria",
      body: "Todo cliente Clique Boost tem acesso a um dashboard privado — métricas reais do Instagram, calendário de conteúdo, tarefas e relatórios em um só lugar. É prova de que a gente não só fala de marketing — a gente constrói os sistemas pra isso.",
    },
    faq: {
      title: "Perguntas respondidas",
      items: [
        {
          q: "Quanto custa?",
          a: "O Marketing 360 é um contrato mensal dimensionado pro seu mercado e objetivos — a gente explica os valores na chamada de estratégia.",
        },
        {
          q: "Tem contrato de fidelidade?",
          a: "A gente trabalha mês a mês depois do período inicial de onboarding — sem fidelidade longa.",
        },
        {
          q: "Em quanto tempo vejo resultado?",
          a: "Consistência de marca e conteúdo aparece em semanas; leads de tráfego pago geralmente começam nos primeiros 30 dias.",
        },
        {
          q: "Vocês atendem só imóveis e seguros?",
          a: "A gente é especializado em corretores e profissionais financeiros — imóveis, seguro de vida e serviços financeiros relacionados.",
        },
        {
          q: "Preciso gravar meu próprio conteúdo?",
          a: "Sim — você é o rosto da sua marca. A gente cuida da edição, estratégia e de tudo em volta disso.",
        },
      ],
    },
    form: {
      title: "Pronto pra parar de correr atrás de lead?",
      subtitle: "Aplique abaixo — a gente revisa cada aplicação pessoalmente.",
      nameLabel: "Nome completo",
      nicheLabel: "Seu nicho",
      nicheOptions: ["Imóveis", "Seguros", "Outros serviços financeiros"],
      marketLabel: "Onde você atua? (cidade/estado)",
      painLabel: "Qual seu maior desafio hoje?",
      submit: "Enviar Aplicação",
      successMessage: "Obrigado — recebemos sua aplicação e vamos entrar em contato em breve.",
    },
    footer: {
      tagline: "Marketing 360 pra corretores que preferem vender a postar.",
      contactLabel: "Contato",
      rights: "Todos os direitos reservados.",
    },
  },
};
```

- [ ] **Step 2: Write `src/components/landing/LanguageProvider.tsx`**

```tsx
// src/components/landing/LanguageProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { landingCopy, type Locale, type LandingCopy } from "@/lib/landingCopy";

const STORAGE_KEY = "landing-locale";

type LanguageContextValue = { locale: Locale; toggleLocale: () => void };

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  // ponytail: lê a preferência salva só depois do mount pra evitar mismatch de hydration
  // (localStorage não existe no server).
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "pt") setLocale(saved);
  }, []);

  function toggleLocale() {
    setLocale((prev) => {
      const next: Locale = prev === "en" ? "pt" : "en";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return <LanguageContext.Provider value={{ locale, toggleLocale }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

export function useLandingCopy(): LandingCopy {
  const { locale } = useLanguage();
  return landingCopy[locale];
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing `landingCopy.ts` or `LanguageProvider.tsx` (unused-export errors for the not-yet-consumed hooks are fine — TypeScript doesn't flag unused exports by default; if `noUnusedLocals` is on and complains, ignore for this task, later tasks consume them).

- [ ] **Step 4: Commit**

```bash
git add src/lib/landingCopy.ts src/components/landing/LanguageProvider.tsx
git commit -m "feat(landing): bilingual copy dictionary and language context"
```

---

### Task 2: Header with language toggle

**Files:**
- Create: `src/components/landing/Header.tsx`

**Interfaces:**
- Consumes: `useLanguage()`, `useLandingCopy()` from `src/components/landing/LanguageProvider.tsx`; `Logo` from `src/components/layout/Logo.tsx`.
- Produces: `Header` (default export) — sticky top bar with logo, EN/PT toggle button, and a CTA link to `#apply`.

- [ ] **Step 1: Write `src/components/landing/Header.tsx`**

```tsx
// src/components/landing/Header.tsx
"use client";

import { Logo } from "@/components/layout/Logo";
import { useLanguage, useLandingCopy } from "./LanguageProvider";

export function Header() {
  const { toggleLocale } = useLanguage();
  const copy = useLandingCopy();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Logo width={140} height={38} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleLocale}
            className="rounded-[var(--radius-card)] border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            aria-label="Toggle language"
          >
            {copy.header.toggleLabel}
          </button>
          <a
            href="#apply"
            className="rounded-[var(--radius-card)] bg-brand-primary px-4 py-1.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] hover:opacity-90"
          >
            {copy.header.navCta}
          </a>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/Header.tsx
git commit -m "feat(landing): header with EN/PT toggle"
```

---

### Task 3: Hero section

**Files:**
- Create: `src/components/landing/Hero.tsx`

**Interfaces:**
- Consumes: `useLandingCopy()`.
- Produces: `Hero` (default export).

- [ ] **Step 1: Write `src/components/landing/Hero.tsx`**

```tsx
// src/components/landing/Hero.tsx
"use client";

import { useLandingCopy } from "./LanguageProvider";

export function Hero() {
  const copy = useLandingCopy();

  return (
    <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:py-28">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand-accent">{copy.hero.eyebrow}</p>
      <h1 className="mb-6 font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
        {copy.hero.headline}
      </h1>
      <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">{copy.hero.subheadline}</p>
      <a
        href="#apply"
        className="inline-block rounded-[var(--radius-card)] bg-brand-primary px-8 py-3 text-base font-medium text-white shadow-[var(--shadow-soft)] hover:opacity-90"
      >
        {copy.hero.cta}
      </a>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/Hero.tsx
git commit -m "feat(landing): hero section"
```

---

### Task 4: Pain points section

**Files:**
- Create: `src/components/landing/PainPoints.tsx`

**Interfaces:**
- Consumes: `useLandingCopy()`.
- Produces: `PainPoints` (default export).

- [ ] **Step 1: Write `src/components/landing/PainPoints.tsx`**

```tsx
// src/components/landing/PainPoints.tsx
"use client";

import { useLandingCopy } from "./LanguageProvider";

export function PainPoints() {
  const copy = useLandingCopy();

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
      <h2 className="mb-10 text-center font-display text-3xl font-semibold text-foreground sm:text-4xl">
        {copy.painPoints.title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {copy.painPoints.items.map((item) => (
          <div
            key={item.title}
            className="rounded-[var(--radius-card)] bg-card p-6 text-card-foreground shadow-[var(--shadow-soft)]"
          >
            <h3 className="mb-2 font-semibold">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-lg font-medium text-foreground">
        {copy.painPoints.closing}
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/PainPoints.tsx
git commit -m "feat(landing): pain points section"
```

---

### Task 5: Promise section

**Files:**
- Create: `src/components/landing/Promise.tsx`

**Interfaces:**
- Consumes: `useLandingCopy()`.
- Produces: `Promise` — **note:** export it as `PromiseSection`, not `Promise` (avoids shadowing the global `Promise` type when imported unqualified elsewhere).

- [ ] **Step 1: Write `src/components/landing/Promise.tsx`**

```tsx
// src/components/landing/Promise.tsx
"use client";

import { useLandingCopy } from "./LanguageProvider";

export function PromiseSection() {
  const copy = useLandingCopy();

  return (
    <section className="bg-brand-primary/5 px-4 py-16 text-center sm:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          {copy.promise.headline}
        </h2>
        <p className="text-lg text-muted-foreground">{copy.promise.body}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/Promise.tsx
git commit -m "feat(landing): promise section"
```

---

### Task 6: Services grid section

**Files:**
- Create: `src/components/landing/Services.tsx`

**Interfaces:**
- Consumes: `useLandingCopy()`.
- Produces: `Services` (default export).

- [ ] **Step 1: Write `src/components/landing/Services.tsx`**

```tsx
// src/components/landing/Services.tsx
"use client";

import { useLandingCopy } from "./LanguageProvider";

export function Services() {
  const copy = useLandingCopy();

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
      <div className="mb-10 text-center">
        <h2 className="mb-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">{copy.services.title}</h2>
        <p className="text-muted-foreground">{copy.services.subtitle}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {copy.services.items.map((item) => (
          <div
            key={item.title}
            className="rounded-[var(--radius-card)] border border-border bg-card p-5 text-card-foreground"
          >
            <h3 className="mb-1.5 font-semibold text-brand-primary">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-xl text-center text-sm text-muted-foreground">{copy.services.aiNote}</p>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/Services.tsx
git commit -m "feat(landing): services grid section"
```

---

### Task 7: Process section

**Files:**
- Create: `src/components/landing/Process.tsx`

**Interfaces:**
- Consumes: `useLandingCopy()`.
- Produces: `Process` (default export).

- [ ] **Step 1: Write `src/components/landing/Process.tsx`**

```tsx
// src/components/landing/Process.tsx
"use client";

import { useLandingCopy } from "./LanguageProvider";

export function Process() {
  const copy = useLandingCopy();

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
      <h2 className="mb-10 text-center font-display text-3xl font-semibold text-foreground sm:text-4xl">
        {copy.process.title}
      </h2>
      <div className="grid gap-6 sm:grid-cols-4">
        {copy.process.steps.map((step, i) => (
          <div key={step.title} className="text-center">
            <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white">
              {i + 1}
            </div>
            <h3 className="mb-1.5 font-semibold text-foreground">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/Process.tsx
git commit -m "feat(landing): process section"
```

---

### Task 8: Testimonials section

**Files:**
- Create: `src/components/landing/Testimonials.tsx`

**Interfaces:**
- Consumes: `useLandingCopy()`.
- Produces: `Testimonials` (default export), `type Testimonial = { quote: string; name: string; role: string }`.

**Important:** do not invent fake client quotes or logos. This component ships with an **empty** `PLACEHOLDER_TESTIMONIALS` array and a code comment marking where real testimonials/logos get added later (content the business owner supplies, not fabricated data) — the section renders its heading either way but only renders cards when the array is non-empty.

- [ ] **Step 1: Write `src/components/landing/Testimonials.tsx`**

```tsx
// src/components/landing/Testimonials.tsx
"use client";

import { useLandingCopy } from "./LanguageProvider";

type Testimonial = { quote: string; name: string; role: string };

// ponytail: sem depoimentos reais ainda (autoridade em construção, ver spec) — array vazio de
// propósito. Preencher com citações e nomes reais de clientes antes de publicar esta seção;
// nunca substituir por texto fabricado.
const PLACEHOLDER_TESTIMONIALS: Testimonial[] = [];

export function Testimonials() {
  const copy = useLandingCopy();

  if (PLACEHOLDER_TESTIMONIALS.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
      <div className="mb-10 text-center">
        <h2 className="mb-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          {copy.testimonials.title}
        </h2>
        <p className="text-muted-foreground">{copy.testimonials.subtitle}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {PLACEHOLDER_TESTIMONIALS.map((t) => (
          <div key={t.name} className="rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
            <p className="mb-3 text-sm italic text-card-foreground">&ldquo;{t.quote}&rdquo;</p>
            <p className="text-sm font-semibold text-foreground">{t.name}</p>
            <p className="text-xs text-muted-foreground">{t.role}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/Testimonials.tsx
git commit -m "feat(landing): testimonials section (empty until real content is supplied)"
```

---

### Task 9: Tech differentiator section

**Files:**
- Create: `src/components/landing/TechDifferentiator.tsx`

**Interfaces:**
- Consumes: `useLandingCopy()`.
- Produces: `TechDifferentiator` (default export). Renders a text block only (no screenshot image yet — same rule as Task 8: don't fabricate a dashboard screenshot; the `<div>` placeholder is a labeled visual frame, not a fake data image, ready for a real screenshot to be dropped in later).

- [ ] **Step 1: Write `src/components/landing/TechDifferentiator.tsx`**

```tsx
// src/components/landing/TechDifferentiator.tsx
"use client";

import { useLandingCopy } from "./LanguageProvider";

export function TechDifferentiator() {
  const copy = useLandingCopy();

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
      <div className="grid items-center gap-8 sm:grid-cols-2">
        <div>
          <h2 className="mb-4 font-display text-3xl font-semibold text-foreground sm:text-4xl">{copy.tech.title}</h2>
          <p className="text-muted-foreground">{copy.tech.body}</p>
        </div>
        {/* ponytail: sem print real do dashboard ainda — substituir por screenshot real antes de publicar. */}
        <div className="flex aspect-video items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-card text-sm text-muted-foreground">
          Dashboard screenshot
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/TechDifferentiator.tsx
git commit -m "feat(landing): tech differentiator section"
```

---

### Task 10: FAQ section

**Files:**
- Create: `src/components/landing/Faq.tsx`

**Interfaces:**
- Consumes: `useLandingCopy()`.
- Produces: `Faq` (default export), uses native `<details>`/`<summary>` — no JS state, no new dependency.

- [ ] **Step 1: Write `src/components/landing/Faq.tsx`**

```tsx
// src/components/landing/Faq.tsx
"use client";

import { useLandingCopy } from "./LanguageProvider";

export function Faq() {
  const copy = useLandingCopy();

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
      <h2 className="mb-10 text-center font-display text-3xl font-semibold text-foreground sm:text-4xl">
        {copy.faq.title}
      </h2>
      <div className="space-y-3">
        {copy.faq.items.map((item) => (
          <details
            key={item.q}
            className="group rounded-[var(--radius-card)] border border-border bg-card p-4 open:shadow-[var(--shadow-soft)]"
          >
            <summary className="cursor-pointer list-none font-medium text-foreground">{item.q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/Faq.tsx
git commit -m "feat(landing): faq section"
```

---

### Task 11: Application form (UI only, no backend)

**Files:**
- Create: `src/components/landing/ApplicationForm.tsx`
- Test: `src/components/landing/ApplicationForm.test.tsx` — skipped, see Step 3 rationale below (no test framework in project; manual check instead).

**Interfaces:**
- Consumes: `useLandingCopy()`.
- Produces: `ApplicationForm` (default export). `id="apply"` on the wrapping `<section>` so `Header`/`Hero` anchor links scroll here.

- [ ] **Step 1: Write `src/components/landing/ApplicationForm.tsx`**

```tsx
// src/components/landing/ApplicationForm.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useLandingCopy } from "./LanguageProvider";

export function ApplicationForm() {
  const copy = useLandingCopy();
  const [submitted, setSubmitted] = useState(false);

  // ponytail: sem submissão real ainda — backend (Supabase + Resend) fica pra uma fase futura
  // (ver docs/superpowers/specs/2026-08-14-landing-page-design.md, "Fora de escopo"). Por ora só
  // confirma no cliente, sem persistir nem enviar nada.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <section id="apply" className="mx-auto max-w-xl px-4 py-16 sm:py-24">
      <div className="mb-8 text-center">
        <h2 className="mb-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">{copy.form.title}</h2>
        <p className="text-muted-foreground">{copy.form.subtitle}</p>
      </div>

      {submitted ? (
        <p className="rounded-[var(--radius-card)] bg-brand-success/10 p-6 text-center text-brand-success">
          {copy.form.successMessage}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-foreground">
              {copy.form.nameLabel}
            </label>
            <input
              id="name"
              name="name"
              required
              className="w-full rounded-[var(--radius-card)] border border-border bg-card px-3 py-2 text-card-foreground"
            />
          </div>
          <div>
            <label htmlFor="niche" className="mb-1 block text-sm font-medium text-foreground">
              {copy.form.nicheLabel}
            </label>
            <select
              id="niche"
              name="niche"
              required
              className="w-full rounded-[var(--radius-card)] border border-border bg-card px-3 py-2 text-card-foreground"
            >
              {copy.form.nicheOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="market" className="mb-1 block text-sm font-medium text-foreground">
              {copy.form.marketLabel}
            </label>
            <input
              id="market"
              name="market"
              required
              className="w-full rounded-[var(--radius-card)] border border-border bg-card px-3 py-2 text-card-foreground"
            />
          </div>
          <div>
            <label htmlFor="pain" className="mb-1 block text-sm font-medium text-foreground">
              {copy.form.painLabel}
            </label>
            <textarea
              id="pain"
              name="pain"
              rows={3}
              required
              className="w-full rounded-[var(--radius-card)] border border-border bg-card px-3 py-2 text-card-foreground"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-[var(--radius-card)] bg-brand-primary px-6 py-3 text-base font-medium text-white shadow-[var(--shadow-soft)] hover:opacity-90"
          >
            {copy.form.submit}
          </button>
        </form>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual check (no test framework in this project)**

Run: `npm run dev`, open `http://localhost:3000` once Task 13 wires this into the page, fill the form, submit, confirm the success message replaces the form and no network request fires (check the Network tab).

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/ApplicationForm.tsx
git commit -m "feat(landing): application form (UI only, no backend yet)"
```

---

### Task 12: Footer

**Files:**
- Create: `src/components/landing/Footer.tsx`

**Interfaces:**
- Consumes: `useLandingCopy()`, `Logo`.
- Produces: `Footer` (default export). Contact email uses `contato.cliqueboost@gmail.com` (known contact address); social links are `href="#"` placeholders — **fill in the real Instagram/LinkedIn handles before publishing**, this is a content fact not derivable from the codebase.

- [ ] **Step 1: Write `src/components/landing/Footer.tsx`**

```tsx
// src/components/landing/Footer.tsx
"use client";

import { Logo } from "@/components/layout/Logo";
import { useLandingCopy } from "./LanguageProvider";

export function Footer() {
  const copy = useLandingCopy();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
        <Logo width={120} height={32} />
        <p className="max-w-sm text-sm text-muted-foreground">{copy.footer.tagline}</p>
        <p className="text-sm text-muted-foreground">
          {copy.footer.contactLabel}:{" "}
          <a href="mailto:contato.cliqueboost@gmail.com" className="text-brand-primary hover:underline">
            contato.cliqueboost@gmail.com
          </a>
        </p>
        {/* ponytail: handles reais de Instagram/LinkedIn ainda não definidos — trocar href="#" antes de publicar. */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground">
            Instagram
          </a>
          <a href="#" className="hover:text-foreground">
            LinkedIn
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          © {year} Clique Boost. {copy.footer.rights}
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/Footer.tsx
git commit -m "feat(landing): footer"
```

---

### Task 13: Assemble the landing page, relocate the internal client index

**Files:**
- Create: `src/app/internal/page.tsx` — the current content of `src/app/page.tsx`, moved verbatim
- Modify: `src/app/page.tsx` — replaced entirely with the assembled landing page

**Interfaces:**
- Consumes: every component from Tasks 1–12 (`LanguageProvider`, `Header`, `Hero`, `PainPoints`, `PromiseSection`, `Services`, `Process`, `Testimonials`, `TechDifferentiator`, `Faq`, `ApplicationForm`, `Footer`).

- [ ] **Step 1: Move the internal index to `src/app/internal/page.tsx`**

Read the current `src/app/page.tsx` (the client-index page with `CLIENTS.map(...)`) and write its exact current content, unchanged, to `src/app/internal/page.tsx`.

- [ ] **Step 2: Replace `src/app/page.tsx` with the landing page**

```tsx
// src/app/page.tsx
import type { Metadata } from "next";
import { LanguageProvider } from "@/components/landing/LanguageProvider";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { PainPoints } from "@/components/landing/PainPoints";
import { PromiseSection } from "@/components/landing/Promise";
import { Services } from "@/components/landing/Services";
import { Process } from "@/components/landing/Process";
import { Testimonials } from "@/components/landing/Testimonials";
import { TechDifferentiator } from "@/components/landing/TechDifferentiator";
import { Faq } from "@/components/landing/Faq";
import { ApplicationForm } from "@/components/landing/ApplicationForm";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Clique Boost — Marketing 360 for Brokers",
  description:
    "Full-service marketing for U.S. real estate and insurance brokers: content, paid traffic, design, and strategy — so you can focus on selling.",
};

export default function LandingPage() {
  return (
    <LanguageProvider>
      <Header />
      <main>
        <Hero />
        <PainPoints />
        <PromiseSection />
        <Services />
        <Process />
        <Testimonials />
        <TechDifferentiator />
        <Faq />
        <ApplicationForm />
      </main>
      <Footer />
    </LanguageProvider>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds with no type errors; `/` and `/internal` both listed as static routes in the build output.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open `http://localhost:3000`:
- Confirm all 9 sections render in order.
- Click the EN/PT toggle in the header, confirm every section's text switches language and the choice survives a page reload (localStorage).
- Click the hero CTA, confirm it scrolls to the application form.
- Submit the form, confirm the success message appears and no request is sent (Network tab empty).
- Open `http://localhost:3000/internal`, confirm the old client-index page still works unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/internal/page.tsx
git commit -m "feat(landing): assemble public landing page, relocate internal client index"
```

---

## Self-Review Notes

- **Spec coverage:** all 10 spec sections have a task (Hero=3, PainPoints=4, Promise=5, Services=6, Process=7, Testimonials=8, TechDifferentiator=9, Faq=10, Form=11, Footer=12); Header/i18n infra=1–2; assembly/relocation=13. Backend/WhatsApp explicitly out of scope per spec, not tasked here.
- **No placeholders:** testimonials and the dashboard screenshot are intentionally empty/labeled — not fabricated data — and are called out as pre-publish content gaps, not implementation gaps.
- **Type consistency:** `PromiseSection` (not `Promise`) used consistently in Task 5 and Task 13 to avoid shadowing the global `Promise`. `useLandingCopy()`/`useLanguage()` signatures match between Task 1's definition and every consumer task.
