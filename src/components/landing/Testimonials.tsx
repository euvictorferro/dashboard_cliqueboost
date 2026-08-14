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
