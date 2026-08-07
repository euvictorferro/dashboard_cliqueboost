"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NavEntry = { label: string; href: string };

const NAV_ENTRIES: NavEntry[] = [
  { label: "Dashboard", href: "" },
  { label: "Tasks", href: "/tasks" },
  { label: "Conteúdos", href: "/conteudos" },
  { label: "Calendário", href: "/calendario" },
  { label: "Bunker", href: "/bunker" },
  { label: "Atas", href: "/atas" },
  { label: "Booster AI", href: "/booster-ai" },
  { label: "Conta", href: "/conta" },
];

export function CmdK({ clientId }: { clientId: string;  }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onCustomOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("cliqueboost:open-cmdk", onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("cliqueboost:open-cmdk", onCustomOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  const filtered = NAV_ENTRIES.filter((e) => e.label.toLowerCase().includes(query.toLowerCase()));

  function go(href: string) {
    setOpen(false);
    router.push(`/${clientId}${href}`);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 pt-[15vh]" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar página..."
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted-foreground">Nada encontrado.</p>}
          {filtered.map((entry) => (
            <button
              key={entry.href}
              type="button"
              onClick={() => go(entry.href)}
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-card-foreground hover:bg-muted"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
