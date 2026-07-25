// src/components/CalendarTimelineView.tsx
"use client";

import { useEffect, useRef } from "react";
import type { ContentCard as ContentCardData } from "@/lib/trello";
import { getContentFormat, FORMAT_BAR_CLASSES } from "@/lib/contentFormat";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isWeekend(day: Date): boolean {
  const weekday = day.getDay();
  return weekday === 0 || weekday === 6;
}

// ponytail: gera um array de dias contínuo do primeiro ao último dia com card real — sem
// paginação, cobre exatamente o intervalo dos dados de verdade (nunca um calendário infinito).
function buildDayRange(datedCards: ContentCardData[]): Date[] {
  if (datedCards.length === 0) return [];
  const timestamps = datedCards.map((c) => c.dueDate!);
  const min = new Date(Math.min(...timestamps));
  const max = new Date(Math.max(...timestamps));
  const start = new Date(min.getFullYear(), min.getMonth(), min.getDate());
  const end = new Date(max.getFullYear(), max.getMonth(), max.getDate());

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function CalendarTimelineView({
  cards,
  onSelectCard,
}: {
  cards: ContentCardData[];
  onSelectCard: (card: ContentCardData) => void;
}) {
  const today = new Date();
  const todayRef = useRef<HTMLDivElement>(null);

  const datedCards = cards.filter((c) => c.dueDate !== null);
  const days = buildDayRange(datedCards);

  function cardsForDay(day: Date): ContentCardData[] {
    return datedCards.filter((c) => isSameDay(new Date(c.dueDate!), day));
  }

  function scrollToToday() {
    todayRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  useEffect(() => {
    scrollToToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem, pra abrir já centralizado em hoje
  }, []);

  if (days.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhum card com data prevista encontrado.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-card-foreground">
          {days[0].getDate()} {MONTH_SHORT[days[0].getMonth()]} {days[0].getFullYear()} — {days[days.length - 1].getDate()}{" "}
          {MONTH_SHORT[days[days.length - 1].getMonth()]} {days[days.length - 1].getFullYear()}
        </h2>
        <button
          type="button"
          onClick={scrollToToday}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
        >
          Hoje
        </button>
      </div>

      <div className="flex gap-px overflow-x-auto rounded-[var(--radius-card)] border border-border bg-border pb-1">
        {days.map((day, i) => {
          const dayIsToday = isSameDay(day, today);
          return (
            <div
              key={i}
              ref={dayIsToday ? todayRef : undefined}
              className={`min-h-[140px] w-32 shrink-0 p-1.5 ${isWeekend(day) ? "bg-muted/60" : "bg-card"}`}
            >
              <p className={`mb-1 text-xs font-medium ${dayIsToday ? "text-brand-primary" : "text-muted-foreground"}`}>
                {WEEKDAY_LABELS[day.getDay()]} {day.getDate()}/{day.getMonth() + 1}
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
          );
        })}
      </div>
    </div>
  );
}
