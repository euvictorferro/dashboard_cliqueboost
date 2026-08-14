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
