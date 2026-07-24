// src/components/ContentCard.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { AssigneeAvatars } from "./AssigneeAvatars";

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getDueDateDisplay(dueDate: number): { text: string; className: string } {
  const due = new Date(dueDate);
  const now = new Date();
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysDiff = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  const text =
    due.getFullYear() === now.getFullYear()
      ? `${String(due.getDate()).padStart(2, "0")} ${MONTHS_PT[due.getMonth()]}`
      : due.toLocaleDateString("pt-BR");

  const className = daysDiff < 0 ? "text-red-400" : daysDiff <= 3 ? "text-amber-400" : "";

  return { text, className };
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

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1" />
      <path d="M5.5 3v2.5L7 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DescriptionIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path
        d="M1.5 1.5h8M1.5 5.5h8M1.5 9.5h5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <path d="M3 5.5l1.5 1.5L8 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
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
          src={`/api/content/${clientId}/cover-proxy?key=${encodeURIComponent(accessKey)}&url=${encodeURIComponent(card.coverImageUrl!)}`}
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
