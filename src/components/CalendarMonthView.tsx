// src/components/CalendarMonthView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";
import { getTimeZoneDateParts, isSameTZDay, formatTZTime } from "@/lib/clientTime";
import { useTimeZone } from "./TimeZoneContext";
import { ContentLabelPills } from "./ContentLabelPills";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

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

// ponytail: grade sempre múltipla de 7 (preenche com null antes do dia 1 e depois do último
// dia, pra alinhar as colunas de domingo a sábado) — sem lib de calendário, é só aritmética de data.
function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarMonthView({
  cards,
  onSelectCard,
}: {
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const timeZone = useTimeZone();
  const todayParts = getTimeZoneDateParts(Date.now(), timeZone);
  const [currentMonth, setCurrentMonth] = useState(new Date(todayParts.year, todayParts.month, 1));

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const cells = buildMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth());

  function cardsForDay(day: Date): ContentCardData[] {
    return datedCards.filter((c) =>
      isSameTZDay(c.dueDate!, { year: day.getFullYear(), month: day.getMonth(), day: day.getDate() }, timeZone)
    );
  }

  function isToday(day: Date): boolean {
    return day.getFullYear() === todayParts.year && day.getMonth() === todayParts.month && day.getDate() === todayParts.day;
  }

  function goToPrevMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-card-foreground">
          {MONTH_LABELS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevMonth}
            aria-label="Mês anterior"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            aria-label="Próximo mês"
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
        {cells.map((day, i) => (
          <div key={i} className="min-h-[110px] bg-card p-1.5">
            {day && (
              <>
                <p className={`mb-1 text-xs font-medium ${isToday(day) ? "text-brand-primary" : "text-muted-foreground"}`}>
                  {day.getDate()}
                </p>
                <div className="space-y-1">
                  {cardsForDay(day).map((card) => (
                    <MonthCardChip key={card.id} card={card} timeZone={timeZone} onSelect={onSelectCard} />
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthCardChip({
  card,
  timeZone,
  onSelect,
}: {
  card: ContentCardData;
  timeZone: string;
  onSelect: (card: ContentCardData) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        type="button"
        onClick={() => onSelect(card)}
        className={`block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium transition-colors ${FORMAT_BAR_CLASSES[getContentFormat(card) ?? "default"]}`}
      >
        {card.name}
      </button>
      {hovered && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-[var(--radius-card)] border border-border bg-card p-3 text-left shadow-[var(--shadow-soft)]">
          <p className="mb-1 text-sm font-semibold leading-tight text-card-foreground">{card.name}</p>
          {card.dueDate && <p className="mb-1.5 text-xs text-muted-foreground">{formatTZTime(card.dueDate, timeZone)}</p>}
          <ContentLabelPills labels={card.labels} size="xs" />
        </div>
      )}
    </div>
  );
}
