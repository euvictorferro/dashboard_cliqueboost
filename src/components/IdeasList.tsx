"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { ContentCardModal } from "./ContentCardModal";

export function IdeasList({
  cards,
  clientId,
  accessKey,
}: {
  cards: ContentCardData[];
  clientId: string;
  accessKey: string;
}) {
  const [selectedCard, setSelectedCard] = useState<ContentCardData | null>(null);

  if (cards.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-6 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma ideia encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => setSelectedCard(card)}
          className="block w-full rounded-[var(--radius-card)] bg-card p-3 text-left shadow-[var(--shadow-soft)] transition-colors hover:bg-card/80"
        >
          {card.labels.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {card.labels.map((label) => (
                <span
                  key={label.id}
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
        </button>
      ))}

      {selectedCard && (
        <ContentCardModal card={selectedCard} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
