// src/lib/nyTime.ts
const NY_TIME_ZONE = "America/New_York";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: NY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type NYDateParts = {
  year: number;
  month: number; // 0-indexed, igual a Date.getMonth()
  day: number;
  hour: number;
  minute: number;
};

// ponytail: usa Intl.DateTimeFormat em vez de matemática de offset na mão — lida com
// DST automaticamente, sem precisar de uma lib de fuso horário.
export function getNYDateParts(ms: number): NYDateParts {
  const parts = partsFormatter.formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const hour = get("hour");
  return {
    year: get("year"),
    month: get("month") - 1,
    day: get("day"),
    hour: hour === 24 ? 0 : hour,
    minute: get("minute"),
  };
}

export function isSameNYDay(ms: number, cell: { year: number; month: number; day: number }): boolean {
  const p = getNYDateParts(ms);
  return p.year === cell.year && p.month === cell.month && p.day === cell.day;
}

export function formatNYTime(ms: number): string {
  const { hour, minute } = getNYDateParts(ms);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
