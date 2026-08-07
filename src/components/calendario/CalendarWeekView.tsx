// src/components/CalendarWeekView.tsx
"use client";

import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_SOLID_CLASSES } from "@/lib/contentFormat";
import { getTimeZoneDateParts, isSameTZDay } from "@/lib/clientTime";
import { useTimeZone } from "@/components/layout/TimeZoneContext";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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
  const weekStart = getWeekStart(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const days = buildWeekGrid(weekStart);

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
        {days.map((day, i) => (
          <div key={i} className="border-r border-border p-2 text-center last:border-r-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{WEEKDAY_LABELS[day.getDay()]}</p>
            <p className={`text-xs ${isToday(day) ? "font-semibold text-brand-primary" : "text-muted-foreground"}`}>
              {day.getDate()} {MONTH_SHORT[day.getMonth()]}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => (
          <div key={i} className="min-h-[180px] border-r border-border p-1.5 transition-colors last:border-r-0 hover:bg-muted/50">
            <div className="space-y-1">
              {cardsForDay(day).map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelectCard(card)}
                  className={`block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium transition-all hover:scale-105 hover:shadow-lg ${
                    FORMAT_SOLID_CLASSES[getContentFormat(card) ?? "default"]
                  }`}
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
