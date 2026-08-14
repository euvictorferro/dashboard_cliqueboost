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
