"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData, ContentList } from "@/lib/trello";
import { ContentCard } from "./ContentCard";
import { ContentCardModal } from "./ContentCardModal";

export function ContentBoard({ lists }: { lists: ContentList[] }) {
  const [selectedCard, setSelectedCard] = useState<ContentCardData | null>(null);

  if (lists.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma lista encontrada.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {lists.map((list) => (
        <div key={list.id} className="w-72 shrink-0 rounded-[var(--radius-card)] bg-muted/60 pb-3">
          <div className="flex items-center gap-2 rounded-t-[var(--radius-card)] bg-muted px-3 py-2.5">
            <p className="text-sm font-bold text-card-foreground">{list.name}</p>
            <span className="text-xs font-medium text-muted-foreground">{list.cards.length}</span>
          </div>
          <div className="space-y-2 px-3 pt-3">
            {list.cards.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Sem cards</p>
            ) : (
              list.cards.map((card) => (
                <ContentCard key={card.id} card={card} onClick={() => setSelectedCard(card)} />
              ))
            )}
          </div>
        </div>
      ))}
      {selectedCard && <ContentCardModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </div>
  );
}
