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
