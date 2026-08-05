// src/components/CalendarView.tsx
"use client";

import { useMemo, useState } from "react";
import type { ContentCard as ContentCardData, ContentLabel } from "@/lib/trello";
import { ContentCardModal } from "./ContentCardModal";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarDayView } from "./CalendarDayView";
import { CalendarListView } from "./CalendarListView";

type ViewMode = "month" | "week" | "day" | "list";

const VIEW_LABELS: Record<ViewMode, string> = {
  month: "Mês",
  week: "Semana",
  day: "Dia",
  list: "Lista",
};

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

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
  const [search, setSearch] = useState("");
  const [activeLabelIds, setActiveLabelIds] = useState<string[]>([]);

  const availableLabels = useMemo(() => {
    const byId = new Map<string, ContentLabel>();
    for (const card of cards) for (const label of card.labels) byId.set(label.id, label);
    return Array.from(byId.values());
  }, [cards]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((card) => {
      if (q && !card.name.toLowerCase().includes(q)) return false;
      if (activeLabelIds.length > 0 && !card.labels.some((l) => activeLabelIds.includes(l.id))) return false;
      return true;
    });
  }, [cards, search, activeLabelIds]);

  function toggleLabel(id: string) {
    setActiveLabelIds((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit gap-1 rounded-md border border-border p-1">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === mode ? "bg-brand-primary/10 text-brand-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {VIEW_LABELS[mode]}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conteúdo..."
            className="w-full rounded-md border border-border bg-card py-1.5 pl-8 pr-7 text-xs text-foreground outline-none focus:border-brand-primary/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-card-foreground"
            >
              <XIcon />
            </button>
          )}
        </div>
      </div>

      {availableLabels.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {availableLabels.map((label) => {
            const active = activeLabelIds.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => toggleLabel(label.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} aria-hidden="true" />
                {label.name}
              </button>
            );
          })}
          {activeLabelIds.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveLabelIds([])}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-card-foreground"
            >
              <XIcon /> Limpar
            </button>
          )}
        </div>
      )}

      {viewMode === "month" && <CalendarMonthView cards={filteredCards} onSelectCard={setSelectedCard} />}
      {viewMode === "week" && <CalendarWeekView cards={filteredCards} onSelectCard={setSelectedCard} />}
      {viewMode === "day" && <CalendarDayView cards={filteredCards} onSelectCard={setSelectedCard} />}
      {viewMode === "list" && <CalendarListView cards={filteredCards} onSelectCard={setSelectedCard} />}

      {selectedCard && (
        <ContentCardModal card={selectedCard} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
