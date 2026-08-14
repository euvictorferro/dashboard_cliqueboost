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
