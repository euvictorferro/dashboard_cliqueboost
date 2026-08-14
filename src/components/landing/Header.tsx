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
        <Logo width={140} height={38} alt="Clique Boost" />
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
