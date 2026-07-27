// src/components/CalendarWeekView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";
import { getNYDateParts, isSameNYDay } from "@/lib/nyTime";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
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

// ponytail: year/month/day aqui são componentes de calendário puros (célula de grade), não um
// instante — igual ao padrão já usado em CalendarMonthView.
function getWeekStart(year: number, month: number, day: number): Date {
  const d = new Date(year, month, day);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function buildWeekGrid(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

export function CalendarWeekView({
  cards,
  onSelectCard,
}: {
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const todayParts = getNYDateParts(Date.now());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayParts.year, todayParts.month, todayParts.day));

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const days = buildWeekGrid(weekStart);

  function cardsForDay(day: Date): ContentCardData[] {
    return datedCards.filter((c) =>
      isSameNYDay(c.dueDate!, { year: day.getFullYear(), month: day.getMonth(), day: day.getDate() })
    );
  }

  function isToday(day: Date): boolean {
    return day.getFullYear() === todayParts.year && day.getMonth() === todayParts.month && day.getDate() === todayParts.day;
  }

  function goToPrevWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }

  function goToNextWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  const weekEnd = days[6];
  const rangeLabel = `${days[0].getDate()} ${MONTH_SHORT[days[0].getMonth()]} — ${weekEnd.getDate()} ${MONTH_SHORT[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-card-foreground">{rangeLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevWeek}
            aria-label="Semana anterior"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={goToNextWeek}
            aria-label="Próxima semana"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-muted px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {days.map((day, i) => (
          <div key={i} className="min-h-[180px] bg-card p-1.5">
            <p className={`mb-1 text-xs font-medium ${isToday(day) ? "text-brand-primary" : "text-muted-foreground"}`}>
              {day.getDate()}
            </p>
            <div className="space-y-1">
              {cardsForDay(day).map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelectCard(card)}
                  className={`block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium transition-colors ${FORMAT_BAR_CLASSES[getContentFormat(card) ?? "default"]}`}
                >
                  {card.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
