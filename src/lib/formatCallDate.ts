// src/lib/formatCallDate.ts
import { getNYDateParts } from "./nyTime";

const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// ponytail: weekday calculado a partir de year/month/day puros (componentes de calendário,
// não um instante) — mesmo padrão já usado em CalendarMonthView/CalendarWeekView.
export function formatCallDateHeader(callAt: number, options?: { withYear?: boolean }): string {
  const { year, month, day } = getNYDateParts(callAt);
  const weekday = new Date(year, month, day).getDay();
  const base = `${WEEKDAY_LABELS[weekday]}., ${day} de ${MONTH_LABELS[month]}.`;
  return options?.withYear ? `${base} de ${year}` : base;
}
