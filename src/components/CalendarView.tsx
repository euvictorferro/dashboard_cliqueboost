// src/components/CalendarView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { ContentCardModal } from "./ContentCardModal";
import { CalendarMonthView } from "./CalendarMonthView";

export function CalendarView({
  cards,
  clientId,
  accessKey,
}: {
  cards: ContentCardData[];
  clientId: string;
  accessKey: string;
}) {
  const [selectedCard, setSelectedCard] = useState<ContentCardData | null>(null);

  return (
    <div>
      <CalendarMonthView cards={cards} onSelectCard={setSelectedCard} />

      {selectedCard && (
        <ContentCardModal card={selectedCard} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
