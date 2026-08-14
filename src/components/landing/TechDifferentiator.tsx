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
