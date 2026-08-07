// src/components/CalendarDayView.tsx
"use client";

import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_SOLID_CLASSES } from "@/lib/contentFormat";
import { isSameTZDay, formatTZTime } from "@/lib/clientTime";
import { useTimeZone } from "@/components/layout/TimeZoneContext";
import { ContentLabelPills } from "@/components/conteudos/ContentLabelPills";

export function CalendarDayView({
  currentDate,
  cards,
  onSelectCard,
}: {
  currentDate: Date;
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const timeZone = useTimeZone();

  const dayCards = cards
    .filter((c) => c.dueDate !== null)
    .filter((c) =>
      isSameTZDay(c.dueDate!, { year: currentDate.getFullYear(), month: currentDate.getMonth(), day: currentDate.getDate() }, timeZone)
    )
    .sort((a, b) => a.dueDate! - b.dueDate!);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {dayCards.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum conteúdo agendado pra esse dia.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {dayCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectCard(card)}
              className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50"
            >
              <span
                className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-semibold text-white ${
                  FORMAT_SOLID_CLASSES[getContentFormat(card) ?? "default"]
                }`}
              >
                {formatTZTime(card.dueDate!, timeZone)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-card-foreground">{card.name}</p>
                <div className="mt-1">
                  <ContentLabelPills labels={card.labels} size="xs" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
