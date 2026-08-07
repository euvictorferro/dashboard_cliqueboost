"use client";

import { useState } from "react";

export type CompareWindows = {
  a: { since: string; until: string };
  b: { since: string; until: string };
};

function daysBetween(since: string, until: string): number | null {
  if (!since || !until) return null;
  const ms = new Date(`${until}T00:00:00Z`).getTime() - new Date(`${since}T00:00:00Z`).getTime();
  const days = Math.round(ms / 86400000);
  return days > 0 ? days : null;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CompareRangePicker({ onApply }: { onApply: (windows: CompareWindows) => void }) {
  const [aSince, setASince] = useState("");
  const [aUntil, setAUntil] = useState("");
  const [bSince, setBSince] = useState("");

  const daysA = daysBetween(aSince, aUntil);
  const bUntil = bSince && daysA ? addDays(bSince, daysA) : null;
  const valid = Boolean(daysA && bSince && bUntil);

  return (
    <div className="w-96 space-y-3 p-4">
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Período A</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={aSince}
            onChange={(e) => setASince(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
          />
          <span className="shrink-0 text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={aUntil}
            onChange={(e) => setAUntil(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Período B</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={bSince}
            onChange={(e) => setBSince(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
          />
          <span className="shrink-0 text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={bUntil ?? ""}
            disabled
            className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm opacity-50"
          />
        </div>
      </div>

      <button
        disabled={!valid}
        onClick={() => valid && onApply({ a: { since: aSince, until: aUntil }, b: { since: bSince, until: bUntil! } })}
        className="w-full rounded-lg bg-brand-primary py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Aplicar
      </button>
    </div>
  );
}
