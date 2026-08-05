// src/components/CallScheduler.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTimeZone } from "./TimeZoneContext";
import { CLIENTS } from "@/lib/clients";
import { getTimeZoneDateParts, formatTZTime } from "@/lib/clientTime";
import { formatCallDateHeader } from "@/lib/formatCallDate";
import { googleCalendarUrl, outlookCalendarUrl, icsDataUrl } from "@/lib/calendarLinks";
import { ChevronLeftIcon, ChevronRightIcon } from "./CalendarIcons";

type CallInfo = { id: string; scheduledAt: number };
type Status = "loading" | "error" | "ready";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

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

function CheckCircleIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarPlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 5.5h11M4 1.5v2M10 1.5v2M7 7.5v3M5.5 9h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function CallScheduler({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const timeZone = useTimeZone();
  const clientName = CLIENTS.find((c) => c.id === clientId)?.name ?? clientId;

  const [status, setStatus] = useState<Status>("loading");
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);
  const [freeSlots, setFreeSlots] = useState<number[]>([]);
  const [rescheduling, setRescheduling] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);

  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  function load() {
    setStatus("loading");
    fetch(`/api/atas/${clientId}/call?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { activeCall: CallInfo | null; freeSlots: number[] };
      })
      .then((data) => {
        setActiveCall(data.activeCall);
        setFreeSlots(data.freeSlots);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  useEffect(load, [clientId, accessKey]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const slot of freeSlots) {
      const p = getTimeZoneDateParts(slot, timeZone);
      const key = dayKey(p.year, p.month, p.day);
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return map;
  }, [freeSlots, timeZone]);

  // ponytail: só roda quando os slots chegam e ainda não há dia/mês escolhido — pré-seleciona o
  // primeiro horário livre, igual ao "defaultMonth/selected" do exemplo.
  useEffect(() => {
    if (status !== "ready" || visibleMonth || freeSlots.length === 0) return;
    const first = freeSlots[0];
    const p = getTimeZoneDateParts(first, timeZone);
    setVisibleMonth(new Date(p.year, p.month, 1));
    setSelectedDayKey(dayKey(p.year, p.month, p.day));
    setSelectedSlot(first);
  }, [status, freeSlots, timeZone, visibleMonth]);

  if (status === "loading") return <p className="text-sm text-muted-foreground">Carregando disponibilidade...</p>;
  if (status === "error") {
    return (
      <p className="rounded-[var(--radius-card)] bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
        Não foi possível carregar o agendamento agora.
      </p>
    );
  }

  function schedule() {
    if (!selectedSlot) return;
    setScheduling(true);
    fetch(`/api/atas/${clientId}/call?key=${encodeURIComponent(accessKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: selectedSlot }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setRescheduling(false);
        setVisibleMonth(null);
        setSelectedDayKey(null);
        setSelectedSlot(null);
        load();
      })
      .catch(() => setStatus("error"))
      .finally(() => setScheduling(false));
  }

  const showPicker = !activeCall || rescheduling;

  return (
    <div className="mb-6 w-full overflow-hidden rounded-lg border border-border bg-card">
      {!showPicker && activeCall ? (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="text-brand-success">
            <CheckCircleIcon />
          </span>
          <p className="text-sm text-card-foreground">
            Sua ligação está agendada para{" "}
            <span className="font-semibold">{formatCallDateHeader(activeCall.scheduledAt, timeZone, { withYear: true })}</span>{" "}
            às <span className="font-semibold">{formatTZTime(activeCall.scheduledAt, timeZone)}</span>.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={() => setRescheduling(true)}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-card-foreground hover:bg-muted"
            >
              Remarcar call
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setSaveMenuOpen((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90"
              >
                <CalendarPlusIcon /> Salvar no calendário
              </button>
              {saveMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-card p-1 shadow-[var(--shadow-soft)]">
                  <a
                    href={googleCalendarUrl(activeCall.scheduledAt, clientName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSaveMenuOpen(false)}
                    className="block rounded px-3 py-2 text-left text-xs font-medium text-card-foreground hover:bg-muted"
                  >
                    Google Agenda
                  </a>
                  <a
                    href={outlookCalendarUrl(activeCall.scheduledAt, clientName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSaveMenuOpen(false)}
                    className="block rounded px-3 py-2 text-left text-xs font-medium text-card-foreground hover:bg-muted"
                  >
                    Outlook
                  </a>
                  <a
                    href={icsDataUrl(activeCall.scheduledAt, clientName)}
                    download="call-clique-boost.ics"
                    onClick={() => setSaveMenuOpen(false)}
                    className="block rounded px-3 py-2 text-left text-xs font-medium text-card-foreground hover:bg-muted"
                  >
                    Apple Calendar / outro (.ics)
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-border p-4">
            <h2 className="text-center text-sm font-bold text-card-foreground">Agende sua call</h2>
          </div>
          <div className="flex flex-col md:flex-row">
            <div className="flex-1 p-6">
              {visibleMonth && (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-card-foreground">
                      {MONTH_LABELS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Mês anterior"
                        onClick={() => setVisibleMonth((prev) => prev && new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-card-foreground"
                      >
                        <ChevronLeftIcon />
                      </button>
                      <button
                        type="button"
                        aria-label="Próximo mês"
                        onClick={() => setVisibleMonth((prev) => prev && new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-card-foreground"
                      >
                        <ChevronRightIcon />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAY_LABELS.map((label) => (
                      <div key={label} className="p-1 text-center text-[11px] font-semibold text-muted-foreground">
                        {label}
                      </div>
                    ))}
                    {buildMonthGrid(visibleMonth.getFullYear(), visibleMonth.getMonth()).map((day, i) => {
                      if (!day) return <div key={i} />;
                      const key = dayKey(day.getFullYear(), day.getMonth(), day.getDate());
                      const hasSlots = (slotsByDay.get(key)?.length ?? 0) > 0;
                      const selected = key === selectedDayKey;
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={!hasSlots}
                          onClick={() => {
                            setSelectedDayKey(key);
                            setSelectedSlot(slotsByDay.get(key)?.[0] ?? null);
                          }}
                          className={`aspect-square rounded-md text-xs font-medium transition-colors ${
                            selected
                              ? "bg-brand-primary text-white"
                              : hasSlots
                                ? "text-card-foreground hover:bg-muted"
                                : "text-muted-foreground/40 line-through"
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {freeSlots.length === 0 && <p className="text-xs text-muted-foreground">Nenhum horário livre nos próximos dias.</p>}
            </div>

            <div className="flex flex-col gap-2 border-t border-border p-4 md:w-52 md:border-l md:border-t-0">
              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {(selectedDayKey ? (slotsByDay.get(selectedDayKey) ?? []) : []).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    disabled={scheduling}
                    onClick={() => setSelectedSlot(slot)}
                    className={`w-full rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                      selectedSlot === slot
                        ? "border-brand-primary bg-brand-primary text-white"
                        : "border-border text-card-foreground hover:bg-muted"
                    }`}
                  >
                    {formatTZTime(slot, timeZone)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {selectedSlot
                ? `${formatCallDateHeader(selectedSlot, timeZone, { withYear: true })} às ${formatTZTime(selectedSlot, timeZone)}`
                : "Selecione uma data e horário pra sua call."}
            </p>
            <button
              type="button"
              disabled={!selectedSlot || scheduling}
              onClick={schedule}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-40"
            >
              {scheduling ? "Agendando..." : "Continuar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
