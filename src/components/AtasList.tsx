// src/components/AtasList.tsx
"use client";

import { useState } from "react";
import type { CallNote } from "@/lib/callNotes";
import { formatCallDateHeader } from "@/lib/formatCallDate";

export function AtasList({ notes }: { notes: CallNote[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (notes.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma ata registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => {
        const isExpanded = expandedId === note.id;
        return (
          <div key={note.id} className="rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : note.id)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <div>
                <p className="text-sm font-bold text-card-foreground">{note.title}</p>
                <p className="text-xs text-muted-foreground">{formatCallDateHeader(note.callAt, { withYear: true })}</p>
              </div>
              <span className={`shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
            {isExpanded && (
              <div className="border-t border-border px-5 py-4">
                <p className="whitespace-pre-wrap text-sm text-card-foreground">{note.content}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
