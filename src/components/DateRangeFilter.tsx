"use client";

import { useState } from "react";
import { DATE_RANGES, type DateRangeId } from "@/lib/metrics";

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5L2 3z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRangeId;
  onChange: (id: DateRangeId) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = DATE_RANGES.find((r) => r.id === value)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-[var(--radius-card)] border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground"
      >
        <FilterIcon />
        {current.label}
      </button>

      {open && (
        <>
          <button
            aria-label="Fechar filtro"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-50 mt-1.5 w-44 overflow-hidden rounded-[var(--radius-card)] border border-border bg-card py-1 shadow-[var(--shadow-soft)]">
            {DATE_RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onChange(r.id);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  r.id === value
                    ? "bg-brand-primary/10 font-medium text-brand-primary"
                    : "text-card-foreground hover:bg-muted"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
