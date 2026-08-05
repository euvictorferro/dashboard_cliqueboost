"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CLIENTS } from "@/lib/clients";
import { getInitials, colorFromName } from "@/lib/avatar";
import { useTheme } from "./ThemeProvider";
import { BugReportModal } from "./BugReportModal";

const THEME_ORDER = ["light", "dark", "system"] as const;
type Theme = (typeof THEME_ORDER)[number];

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="2.75" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M7 1v1.3M7 11.7V13M13 7h-1.3M2.3 7H1M11.2 2.8l-.9.9M3.7 10.3l-.9.9M11.2 11.2l-.9-.9M3.7 3.7l-.9-.9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M12 8.4A5.3 5.3 0 1 1 5.6 2a4.2 4.2 0 0 0 6.4 6.4z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1" y="2.5" width="12" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 12.5h5M7 10v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M5.5 12.5H2.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3M9.5 9.5L13 6 9.5 2.5M13 6H5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AccountCard({
  clientId,
  accessKey,
  pageLabel,
}: {
  clientId: string;
  accessKey: string;
  pageLabel: string;
}) {
  const client = CLIENTS.find((c) => c.id === clientId);
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [bugModalOpen, setBugModalOpen] = useState(false);
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
  const themeIndex = THEME_ORDER.indexOf(theme as Theme);
  const ThemeIcon = [SunIcon, MoonIcon, MonitorIcon][themeIndex];

  function cycleTheme() {
    setTheme(THEME_ORDER[(themeIndex + 1) % THEME_ORDER.length]);
  }

  return (
    <div
      className="relative border-t border-border pt-3"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {open && !bugModalOpen && (
        <div className="absolute bottom-full left-0 w-full rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-soft)]">
          <Link
            href={`/${clientId}/conta?key=${encodeURIComponent(accessKey)}`}
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-card-foreground hover:bg-muted"
          >
            Ajustes
          </Link>

          <button
            type="button"
            onClick={() => {
              setBugModalOpen(true);
              setOpen(false);
            }}
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-card-foreground hover:bg-muted"
          >
            Reportar bug
          </button>

          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-card-foreground">Tema</span>
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`Tema: ${theme}. Clique pra alternar.`}
              className="relative h-6 w-[52px] rounded-full bg-muted p-1"
            >
              <span
                className="absolute top-1 flex h-4 w-4 items-center justify-center rounded-full bg-card text-brand-primary shadow-sm transition-all"
                style={{ left: `${4 + themeIndex * 14}px` }}
              >
                <ThemeIcon />
              </span>
            </button>
          </div>

          <Link
            href="/sair"
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white"
          >
            Sair
            <LogOutIcon />
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
      {bugModalOpen && (
        <BugReportModal
          clientId={clientId}
          accessKey={accessKey}
          currentPageLabel={pageLabel}
          onClose={() => setBugModalOpen(false)}
        />
      )}
    </div>
  );
}
