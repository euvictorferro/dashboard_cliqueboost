"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CLIENTS } from "@/lib/clients";
import { getInitials, colorFromName } from "@/lib/avatar";
import { useTheme } from "./ThemeProvider";

const THEME_LABELS = { light: "Claro", dark: "Escuro", system: "Sistema" } as const;

export function AccountCard({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const client = CLIENTS.find((c) => c.id === clientId);
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      .then((data) => setEmail(typeof data.contactEmail === "string" ? data.contactEmail : null))
      .catch(() => setEmail(null));
  }, [clientId, accessKey]);

  if (!client) return null;

  const initials = getInitials(client.name);
  const avatarColor = colorFromName(client.name);

  return (
    <div className="relative border-t border-border pt-3">
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-full rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-soft)]">
          {!themeMenuOpen && (
            <>
              <button
                type="button"
                onClick={() => setThemeMenuOpen(true)}
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-card-foreground hover:bg-muted"
              >
                Tema
              </button>
              <Link
                href={`/${clientId}/conta?key=${encodeURIComponent(accessKey)}`}
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-card-foreground hover:bg-muted"
              >
                Configurações
              </Link>
              <Link href="/sair" className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-card-foreground hover:bg-muted">
                Sair
              </Link>
            </>
          )}
          {themeMenuOpen && (
            <>
              <button
                type="button"
                onClick={() => setThemeMenuOpen(false)}
                className="mb-1 flex w-full items-center rounded-md px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
              >
                ← Voltar
              </button>
              {(Object.keys(THEME_LABELS) as Array<keyof typeof THEME_LABELS>).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                    theme === t ? "text-brand-primary" : "text-card-foreground"
                  }`}
                >
                  {THEME_LABELS[t]}
                  {theme === t && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setThemeMenuOpen(false);
        }}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-card-foreground">{client.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{email ?? "..."}</span>
        </span>
      </button>
    </div>
  );
}
