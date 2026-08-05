"use client";

import { useEffect, useState } from "react";
import { US_TIMEZONES } from "@/lib/clientTime";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type HourFormat = "12h" | "24h";

const CITY_BY_TIMEZONE: Record<string, string> = {
  "America/New_York": "Nova York",
  "America/Chicago": "Chicago",
  "America/Denver": "Denver",
  "America/Los_Angeles": "Los Angeles",
};

const HOUR_FORMAT_STORAGE_KEY = "conta-hour-format";

function readStoredHourFormat(): HourFormat {
  if (typeof window === "undefined") return "24h";
  return window.localStorage.getItem(HOUR_FORMAT_STORAGE_KEY) === "12h" ? "12h" : "24h";
}

export function ContaFusoSection({
  timeZone,
  onTimeZoneChange,
  saveStatus,
  onSave,
}: {
  timeZone: string;
  onTimeZoneChange: (value: string) => void;
  saveStatus: SaveStatus;
  onSave: () => void;
}) {
  const [hourFormat, setHourFormat] = useState<HourFormat>("24h");
  const [now, setNow] = useState<Date | null>(null);

  // ponytail: preferência de 12h/24h é só de exibição, fica no localStorage (mesmo padrão do
  // ThemeProvider) — não precisa de coluna nova no banco nem sincronizar entre dispositivos.
  useEffect(() => {
    setHourFormat(readStoredHourFormat());
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  function toggleHourFormat() {
    const next: HourFormat = hourFormat === "24h" ? "12h" : "24h";
    setHourFormat(next);
    window.localStorage.setItem(HOUR_FORMAT_STORAGE_KEY, next);
  }

  const badge =
    saveStatus === "saved"
      ? { label: "Salvo", tone: "success" as const }
      : saveStatus === "error"
        ? { label: "Erro ao salvar", tone: "warning" as const }
        : undefined;

  const currentTime = now
    ? new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: hourFormat === "12h" }).format(now)
    : "--:--";

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Fuso horário</h2>
      <p className="mb-5 text-xs text-muted-foreground">Define o horário exibido no Calendário e nas Atas.</p>

      <div className="max-w-sm">
        <div className="mb-4 flex items-center justify-between rounded-md bg-muted px-3 py-2.5">
          <span className="text-sm font-medium text-card-foreground">{CITY_BY_TIMEZONE[timeZone] ?? timeZone}</span>
          <span className="text-lg font-bold tabular-nums text-brand-primary">{currentTime}</span>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <label className="text-xs text-muted-foreground" htmlFor="conta-fuso-select">
            Fuso
          </label>
          <select
            id="conta-fuso-select"
            value={timeZone}
            onChange={(e) => onTimeZoneChange(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-card-foreground outline-none"
          >
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Formato de hora</span>
          <button
            type="button"
            onClick={toggleHourFormat}
            aria-label={`Formato de hora: ${hourFormat}. Clique pra alternar.`}
            className="relative h-6 w-[76px] rounded-full bg-muted p-1"
          >
            <span
              className="absolute top-1 flex h-4 w-8 items-center justify-center rounded-full bg-card text-[10px] font-semibold text-brand-primary shadow-sm transition-all"
              style={{ left: hourFormat === "24h" ? "4px" : "36px" }}
            >
              {hourFormat}
            </span>
          </button>
        </div>

        {badge && (
          <span
            className={`mb-3 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              badge.tone === "success" ? "bg-brand-success/10 text-brand-success" : "bg-amber-500/10 text-amber-600"
            }`}
          >
            {badge.label}
          </span>
        )}

        <div>
          <button
            type="button"
            onClick={onSave}
            disabled={saveStatus === "saving"}
            className="rounded-md bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
