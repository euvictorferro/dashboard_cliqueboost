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
