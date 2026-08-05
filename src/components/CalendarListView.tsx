// src/components/CalendarListView.tsx
"use client";

import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_DOT_CLASSES } from "@/lib/contentFormat";
import { formatTZTime, getTimeZoneDateParts } from "@/lib/clientTime";
import { useTimeZone } from "./TimeZoneContext";
import { ContentLabelPills } from "./ContentLabelPills";

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function CalendarListView({
  cards,
  onSelectCard,
}: {
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const timeZone = useTimeZone();
  const datedCards = cards
    .filter((c) => c.dueDate !== null)
    .sort((a, b) => a.dueDate! - b.dueDate!);

  if (datedCards.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Nenhum conteúdo agendado.</p>
      </div>
    );
  }

  const groups = new Map<string, ContentCardData[]>();
  for (const card of datedCards) {
    const parts = getTimeZoneDateParts(card.dueDate!, timeZone);
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    const list = groups.get(key) ?? [];
    list.push(card);
    groups.set(key, list);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="space-y-6">
        {Array.from(groups.entries()).map(([key, groupCards]) => {
          const [year, month, day] = key.split("-").map(Number);
          const weekday = new Date(year, month, day).getDay();
          return (
            <div key={key}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {WEEKDAY_LABELS[weekday]}, {day} de {MONTH_LABELS[month]}
              </h3>
              <div className="space-y-2">
                {groupCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onSelectCard(card)}
                    className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-all hover:scale-[1.01] hover:shadow-md"
                  >
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${FORMAT_DOT_CLASSES[getContentFormat(card) ?? "default"]}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-card-foreground">{card.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatTZTime(card.dueDate!, timeZone)}</span>
                        <ContentLabelPills labels={card.labels} size="xs" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
