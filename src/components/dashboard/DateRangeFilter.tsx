"use client";

import { useState } from "react";
import { DATE_RANGES, type DateRangeId } from "@/lib/metrics";
import { CompareRangePicker, type CompareWindows } from "@/components/dashboard/CompareRangePicker";

function ChevronIcon() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DateRangeFilter({
  value,
  onChange,
  onApplyCompare,
}: {
  value: DateRangeId;
  onChange: (id: DateRangeId) => void;
  onApplyCompare: (windows: CompareWindows) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "custom">("list");
  const current = DATE_RANGES.find((r) => r.id === value)!;

  function close() {
    setOpen(false);
    setView("list");
  }

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
          <button aria-label="Fechar filtro" className="fixed inset-0 z-40 cursor-default" onClick={close} />
          <div className="absolute right-0 z-50 mt-1.5 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-soft)]">
            {view === "custom" ? (
              <CompareRangePicker
                onApply={(windows) => {
                  onApplyCompare(windows);
                  close();
                }}
              />
            ) : (
              <div className="w-48 py-1">
                {DATE_RANGES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      if (r.id === "custom") {
                        setView("custom");
                        return;
                      }
                      onChange(r.id);
                      close();
                    }}
                    className={`block w-full px-4 py-2 text-left text-sm ${
                      r.id === value ? "font-semibold text-brand-primary" : "text-card-foreground hover:bg-muted"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
