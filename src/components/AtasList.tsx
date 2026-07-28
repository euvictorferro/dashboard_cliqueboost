// src/components/AtasList.tsx
"use client";

import Link from "next/link";
import type { CallNote } from "@/lib/callNotes";
import { formatCallDateHeader } from "@/lib/formatCallDate";
import { getNYDateParts, formatNYTime } from "@/lib/nyTime";

function FileTextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M5 2h5.5L14 5.5V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 8h5M6.5 10.5h5M6.5 13h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type DateGroup = { headerLabel: string; notes: CallNote[] };

// ponytail: notas já vêm ordenadas por callAt decrescente da API — só precisa agrupar
// consecutivas do mesmo dia-calendário em NY, sem reordenar nada.
function groupByDay(notes: CallNote[]): DateGroup[] {
  const groups: DateGroup[] = [];
  let lastKey: string | null = null;

  for (const note of notes) {
    const parts = getNYDateParts(note.callAt);
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    if (key !== lastKey) {
      groups.push({ headerLabel: formatCallDateHeader(note.callAt), notes: [note] });
      lastKey = key;
    } else {
      groups[groups.length - 1].notes.push(note);
    }
  }
  return groups;
}

export function AtasList({
  notes,
  clientId,
  accessKey,
}: {
  notes: CallNote[];
  clientId: string;
  accessKey: string;
}) {
  if (notes.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma ata registrada ainda.</p>
      </div>
    );
  }

  const groups = groupByDay(notes);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.headerLabel + group.notes[0].id}>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{group.headerLabel}</p>
          <div className="space-y-2">
            {group.notes.map((note) => (
              <Link
                key={note.id}
                href={`/${clientId}/atas/${note.id}?key=${encodeURIComponent(accessKey)}`}
                className="flex items-center gap-3 rounded-[var(--radius-card)] bg-card px-4 py-3 shadow-[var(--shadow-soft)] transition-colors hover:bg-muted"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileTextIcon />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-card-foreground">{note.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatNYTime(note.callAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
