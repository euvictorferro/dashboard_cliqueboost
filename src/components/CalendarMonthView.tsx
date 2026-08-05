// src/components/CalendarMonthView.tsx
"use client";

import { useState } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_SOLID_CLASSES } from "@/lib/contentFormat";
import { getTimeZoneDateParts, isSameTZDay, formatTZTime } from "@/lib/clientTime";
import { useTimeZone } from "./TimeZoneContext";
import { ContentLabelPills } from "./ContentLabelPills";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
  currentDate,
  cards,
  onSelectCard,
}: {
  currentDate: Date;
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const timeZone = useTimeZone();
  const todayParts = getTimeZoneDateParts(Date.now(), timeZone);

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const cells = buildMonthGrid(currentDate.getFullYear(), currentDate.getMonth());

  function cardsForDay(day: Date): ContentCardData[] {
    return datedCards.filter((c) =>
      isSameTZDay(c.dueDate!, { year: day.getFullYear(), month: day.getMonth(), day: day.getDate() }, timeZone)
    );
  }

  function isToday(day: Date): boolean {
    return day.getFullYear() === todayParts.year && day.getMonth() === todayParts.month && day.getDate() === todayParts.day;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-r border-border p-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => (
          <div
            key={i}
            className={`min-h-24 border-b border-r border-border p-1.5 transition-colors last:border-r-0 hover:bg-muted/50 ${
              !day ? "bg-muted/30" : ""
            }`}
          >
            {day && (
              <>
                <div
                  className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday(day) ? "bg-brand-primary font-semibold text-white" : "text-muted-foreground"
                  }`}
                >
                  {day.getDate()}
                </div>
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
        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-all ${
          FORMAT_SOLID_CLASSES[getContentFormat(card) ?? "default"]
        } ${hovered ? "z-10 scale-105 shadow-lg" : ""}`}
      >
        {card.name}
      </button>
      {hovered && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-[var(--radius-card)] border border-border bg-card p-3 text-left shadow-xl">
          <p className="mb-1 text-sm font-semibold leading-tight text-card-foreground">{card.name}</p>
          {card.dueDate && <p className="mb-1.5 text-xs text-muted-foreground">{formatTZTime(card.dueDate, timeZone)}</p>}
          <ContentLabelPills labels={card.labels} size="xs" />
        </div>
      )}
    </div>
  );
}
