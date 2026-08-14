// src/components/landing/Footer.tsx
"use client";

import { Logo } from "@/components/layout/Logo";
import { useLandingCopy } from "./LanguageProvider";

export function Footer() {
  const copy = useLandingCopy();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
        <Logo width={120} height={32} />
        <p className="max-w-sm text-sm text-muted-foreground">{copy.footer.tagline}</p>
        <p className="text-sm text-muted-foreground">
          {copy.footer.contactLabel}:{" "}
          <a href="mailto:contato.cliqueboost@gmail.com" className="text-brand-primary hover:underline">
            contato.cliqueboost@gmail.com
          </a>
        </p>
        {/* ponytail: handles reais de Instagram/LinkedIn ainda não definidos — trocar href="#" antes de publicar. */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground">
            Instagram
          </a>
          <a href="#" className="hover:text-foreground">
            LinkedIn
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          © {year} Clique Boost. {copy.footer.rights}
        </p>
      </div>
    </footer>
  );
}
