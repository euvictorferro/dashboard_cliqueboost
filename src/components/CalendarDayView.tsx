// src/components/CalendarDayView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";
import { getTimeZoneDateParts, isSameTZDay, formatTZTime } from "@/lib/clientTime";
import { useTimeZone } from "./TimeZoneContext";

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarDayView({
  cards,
  onSelectCard,
}: {
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const timeZone = useTimeZone();
  const todayParts = getTimeZoneDateParts(Date.now(), timeZone);
  const [currentDay, setCurrentDay] = useState(() => new Date(todayParts.year, todayParts.month, todayParts.day));

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const dayCards = datedCards
    .filter((c) =>
      isSameTZDay(c.dueDate!, { year: currentDay.getFullYear(), month: currentDay.getMonth(), day: currentDay.getDate() }, timeZone)
    )
    .sort((a, b) => a.dueDate! - b.dueDate!);

  function goToPrevDay() {
    setCurrentDay((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }

  function goToNextDay() {
    setCurrentDay((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }

  const label = `${WEEKDAY_LABELS[currentDay.getDay()]}, ${currentDay.getDate()} ${MONTH_SHORT[currentDay.getMonth()]} ${currentDay.getFullYear()}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-card-foreground">{label}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevDay}
            aria-label="Dia anterior"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={goToNextDay}
            aria-label="Próximo dia"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {dayCards.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-muted-foreground">Nenhum conteúdo agendado pra esse dia.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dayCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectCard(card)}
              className={`flex w-full items-center gap-3 rounded-[var(--radius-card)] px-4 py-3 text-left transition-colors ${FORMAT_BAR_CLASSES[getContentFormat(card) ?? "default"]}`}
            >
              <span className="text-xs font-semibold tabular-nums">{formatTZTime(card.dueDate!, timeZone)}</span>
              <span className="truncate text-sm font-medium">{card.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
