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
