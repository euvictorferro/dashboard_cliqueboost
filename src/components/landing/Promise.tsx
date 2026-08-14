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
