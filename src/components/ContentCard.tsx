// src/components/ContentCard.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";

function formatDueDate(dueDate: number): string {
  return new Date(dueDate).toLocaleDateString("pt-BR");
}

function AttachmentIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path
        d="M8.3 3.3L4.6 7a1.5 1.5 0 1 1-2.1-2.1l3.7-3.7a1 1 0 1 1 1.4 1.4L4.2 6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ContentCard({
  card,
  clientId,
  accessKey,
  onClick,
}: {
  card: ContentCardData;
  clientId: string;
  accessKey: string;
  onClick: () => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const hasMeta = card.dueDate !== null || card.assignees.length > 0 || card.attachments.length > 0;
  const showCover = card.coverImageUrl !== null && !coverFailed;

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full overflow-hidden rounded-[var(--radius-card)] bg-card text-left shadow-[var(--shadow-soft)] transition-colors hover:bg-card/80"
    >
      {showCover && (
        // eslint-disable-next-line @next/next/no-img-element -- imagem vem do proxy autenticado, não é asset local
        <img
          src={`/api/content/${clientId}/cover-proxy?key=${encodeURIComponent(accessKey)}&url=${encodeURIComponent(card.coverImageUrl!)}`}
          alt=""
          className="h-24 w-full object-cover"
          onError={() => setCoverFailed(true)}
        />
      )}
      <div className="p-2.5">
        {card.labels.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {card.labels.map((label, i) => (
              <span
                key={`${label.name}-${i}`}
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm font-medium text-card-foreground">{card.name}</p>
        {card.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{card.description}</p>}
        {hasMeta && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {card.dueDate !== null && <span>{formatDueDate(card.dueDate)}</span>}
            {card.assignees.length > 0 && <span>{card.assignees.join(", ")}</span>}
            {card.attachments.length > 0 && (
              <span className="flex items-center gap-1">
                <AttachmentIcon />
                {card.attachments.length}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
