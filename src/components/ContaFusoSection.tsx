"use client";

import { US_TIMEZONES } from "@/lib/clientTime";
import { ContaField } from "./ContaField";

type SaveStatus = "idle" | "saving" | "saved" | "error";

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
  const badge =
    saveStatus === "saved"
      ? { label: "Salvo", tone: "success" as const }
      : saveStatus === "error"
        ? { label: "Erro ao salvar", tone: "warning" as const }
        : undefined;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Fuso horário</h2>
      <p className="mb-5 text-xs text-muted-foreground">Define o horário exibido no Calendário e nas Atas.</p>

      <div className="max-w-sm">
        <ContaField label="Fuso" badge={badge}>
          <select
            value={timeZone}
            onChange={(e) => onTimeZoneChange(e.target.value)}
            className="w-full bg-transparent text-sm font-medium text-card-foreground outline-none"
          >
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </ContaField>
        <button
          type="button"
          onClick={onSave}
          disabled={saveStatus === "saving"}
          className="mt-3 rounded-md bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
        >
          {saveStatus === "saving" ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
