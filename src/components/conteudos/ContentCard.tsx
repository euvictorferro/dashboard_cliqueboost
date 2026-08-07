// src/components/ContentCard.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getDueDateDisplay } from "@/lib/dateDisplay";
import { AssigneeAvatars } from "./AssigneeAvatars";
import { AttachmentIcon, ChecklistIcon, ClockIcon, DescriptionIcon } from "./icons";

export function ContentCard({
  card,
  clientId,
  onClick,
}: {
  card: ContentCardData;
  clientId: string;
  onClick: () => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const dueDisplay = card.dueDate !== null ? getDueDateDisplay(card.dueDate) : null;
  const hasMeta =
    card.dueDate !== null ||
    card.description !== "" ||
    card.attachments.length > 0 ||
    card.checklist !== null ||
    card.assignees.length > 0;
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
          src={`/api/content/${clientId}/cover-proxy?url=${encodeURIComponent(card.coverImageUrl!)}`}
          alt=""
          className="aspect-[3/4] w-full object-cover"
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
        {hasMeta && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {dueDisplay && (
              <span className={`flex items-center gap-1 ${dueDisplay.className}`}>
                <ClockIcon />
                {dueDisplay.text}
              </span>
            )}
            {card.description !== "" && <DescriptionIcon />}
            {card.attachments.length > 0 && (
              <span className="flex items-center gap-1">
                <AttachmentIcon />
                {card.attachments.length}
              </span>
            )}
            {card.checklist !== null && (
              <span className="flex items-center gap-1">
                <ChecklistIcon />
                {card.checklist.checked}/{card.checklist.total}
              </span>
            )}
            {card.assignees.length > 0 && (
              <span className="ml-auto">
                <AssigneeAvatars assignees={card.assignees} size="xs" />
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
