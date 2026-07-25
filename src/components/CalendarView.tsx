// src/components/CalendarView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { ContentCardModal } from "./ContentCardModal";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarTimelineView } from "./CalendarTimelineView";

type ViewMode = "month" | "timeline";

export function CalendarView({
  cards,
  clientId,
  accessKey,
}: {
  cards: ContentCardData[];
  clientId: string;
  accessKey: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedCard, setSelectedCard] = useState<ContentCardData | null>(null);

  return (
    <div>
      <div className="mb-4 flex w-fit gap-1 rounded-md border border-border p-1">
        <button
          type="button"
          onClick={() => setViewMode("month")}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
            viewMode === "month" ? "bg-brand-primary/10 text-brand-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Mês
        </button>
        <button
          type="button"
          onClick={() => setViewMode("timeline")}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
            viewMode === "timeline" ? "bg-brand-primary/10 text-brand-primary" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Timeline
        </button>
      </div>

      {viewMode === "month" ? (
        <CalendarMonthView cards={cards} onSelectCard={setSelectedCard} />
      ) : (
        <CalendarTimelineView cards={cards} onSelectCard={setSelectedCard} />
      )}

      {selectedCard && (
        <ContentCardModal card={selectedCard} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
