// src/lib/clientTime.ts
export const DEFAULT_TIME_ZONE = "America/New_York";

export const US_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Horário do Leste (ET)" },
  { value: "America/Chicago", label: "Horário Central (CT)" },
  { value: "America/Denver", label: "Horário da Montanha (MT)" },
  { value: "America/Los_Angeles", label: "Horário do Pacífico (PT)" },
];

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export type TimeZoneDateParts = {
  year: number;
  month: number; // 0-indexed, igual a Date.getMonth()
  day: number;
  hour: number;
  minute: number;
};

// ponytail: usa Intl.DateTimeFormat em vez de matemática de offset na mão — lida com DST
// automaticamente. Formatter cacheado por fuso (só 4 possíveis) pra não recriar a cada chamada.
export function getTimeZoneDateParts(ms: number, timeZone: string): TimeZoneDateParts {
  const parts = getPartsFormatter(timeZone).formatToParts(new Date(ms));
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

export function isSameTZDay(ms: number, cell: { year: number; month: number; day: number }, timeZone: string): boolean {
  const p = getTimeZoneDateParts(ms, timeZone);
  return p.year === cell.year && p.month === cell.month && p.day === cell.day;
}

export function formatTZTime(ms: number, timeZone: string): string {
  const { hour, minute } = getTimeZoneDateParts(ms, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
