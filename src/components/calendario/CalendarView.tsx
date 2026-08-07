// src/components/CalendarView.tsx
"use client";

import { useMemo, useState } from "react";
import type { ContentCard as ContentCardData, ContentLabel } from "@/lib/trello";
import { getTimeZoneDateParts } from "@/lib/clientTime";
import { useTimeZone } from "@/components/layout/TimeZoneContext";
import { ContentCardModal } from "@/components/conteudos/ContentCardModal";
import { CalendarMonthView } from "@/components/calendario/CalendarMonthView";
import { CalendarWeekView } from "@/components/calendario/CalendarWeekView";
import { CalendarDayView } from "@/components/calendario/CalendarDayView";
import { CalendarListView } from "@/components/calendario/CalendarListView";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  GridIcon,
  ClockIcon,
  ListIcon,
  SearchIcon,
  XIcon,
  FilterIcon,
} from "@/components/calendario/CalendarIcons";

type ViewMode = "month" | "week" | "day" | "list";

const VIEW_OPTIONS: { mode: ViewMode; label: string; icon: () => React.ReactNode }[] = [
  { mode: "month", label: "Mês", icon: CalendarIcon },
  { mode: "week", label: "Semana", icon: GridIcon },
  { mode: "day", label: "Dia", icon: ClockIcon },
  { mode: "list", label: "Lista", icon: ListIcon },
];

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function CalendarView({
  cards,
  clientId,
}: {
  cards: ContentCardData[];
  clientId: string;
}) {
  const timeZone = useTimeZone();
  const todayParts = getTimeZoneDateParts(Date.now(), timeZone);
  const today = new Date(todayParts.year, todayParts.month, todayParts.day);

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(today);
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

  function navigate(direction: -1 | 1) {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "month") next.setMonth(prev.getMonth() + direction);
      else if (viewMode === "week") next.setDate(prev.getDate() + direction * 7);
      else if (viewMode === "day") next.setDate(prev.getDate() + direction);
      return next;
    });
  }

  const title = useMemo(() => {
    if (viewMode === "month") return `${MONTH_LABELS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (viewMode === "week") {
      const start = getWeekStart(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.getDate()} ${MONTH_SHORT[start.getMonth()]} — ${end.getDate()} ${MONTH_SHORT[end.getMonth()]} ${end.getFullYear()}`;
    }
    if (viewMode === "day") {
      return `${WEEKDAY_LABELS[currentDate.getDay()]}, ${currentDate.getDate()} de ${MONTH_LABELS[currentDate.getMonth()]}`;
    }
    return "Todos os conteúdos";
  }, [viewMode, currentDate]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-card-foreground sm:text-xl">{title}</h2>
          {viewMode !== "list" && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Anterior"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-card-foreground"
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                onClick={() => setCurrentDate(today)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-card-foreground hover:bg-muted"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => navigate(1)}
                aria-label="Próximo"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-card-foreground"
              >
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {VIEW_OPTIONS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${
                viewMode === mode ? "bg-muted text-card-foreground" : "text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <Icon />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-64">
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

        {availableLabels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FilterIcon /> Formato:
            </span>
            {availableLabels.map((label) => {
              const active = activeLabelIds.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggleLabel(label.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
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
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-card-foreground"
              >
                <XIcon /> Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {viewMode === "month" && <CalendarMonthView currentDate={currentDate} cards={filteredCards} onSelectCard={setSelectedCard} />}
      {viewMode === "week" && <CalendarWeekView currentDate={currentDate} cards={filteredCards} onSelectCard={setSelectedCard} />}
      {viewMode === "day" && <CalendarDayView currentDate={currentDate} cards={filteredCards} onSelectCard={setSelectedCard} />}
      {viewMode === "list" && <CalendarListView cards={filteredCards} onSelectCard={setSelectedCard} />}

      {selectedCard && (
        <ContentCardModal card={selectedCard} clientId={clientId} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
