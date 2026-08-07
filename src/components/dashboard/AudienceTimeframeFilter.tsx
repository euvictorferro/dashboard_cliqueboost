"use client";

import { useState } from "react";
import { AUDIENCE_TIMEFRAMES, type AudienceTimeframeId } from "@/lib/audience";

function ChevronIcon() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AudienceTimeframeFilter({
  value,
  onChange,
}: {
  value: AudienceTimeframeId;
  onChange: (id: AudienceTimeframeId) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = AUDIENCE_TIMEFRAMES.find((t) => t.id === value)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm shadow-[var(--shadow-soft)]"
      >
        <span className="text-muted-foreground">Período:</span>
        <span className="font-semibold text-card-foreground">{current.label}</span>
        <ChevronIcon />
      </button>

      {open && (
        <>
          <button
            aria-label="Fechar filtro"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1.5 w-48 overflow-hidden rounded-xl bg-card py-1 shadow-[var(--shadow-soft)]">
            {AUDIENCE_TIMEFRAMES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onChange(t.id);
                  setOpen(false);
                }}
                className={`block w-full px-4 py-2 text-left text-sm ${
                  t.id === value ? "font-semibold text-brand-primary" : "text-card-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
