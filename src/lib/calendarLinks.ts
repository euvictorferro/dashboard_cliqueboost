// src/lib/calendarLinks.ts
// ponytail: gera links/arquivo pro cliente salvar a call no calendário dele — não depende do
// Google Service Account (isso fica em googleCalendar.ts, server-only), só formata datas.

const CALL_DURATION_MINUTES = 30; // mesmo valor de SLOT_MINUTES em googleCalendar.ts

function toUtcStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function callWindow(startMs: number): { startMs: number; endMs: number } {
  return { startMs, endMs: startMs + CALL_DURATION_MINUTES * 60_000 };
}

export function googleCalendarUrl(startMs: number, clientName: string): string {
  const { startMs: s, endMs: e } = callWindow(startMs);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Call ${clientName}, Clique Boost`,
    dates: `${toUtcStamp(s)}/${toUtcStamp(e)}`,
    details: "Call agendada via dashboard Clique Boost.",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(startMs: number, clientName: string): string {
  const { startMs: s, endMs: e } = callWindow(startMs);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: `Call ${clientName}, Clique Boost`,
    startdt: new Date(s).toISOString(),
    enddt: new Date(e).toISOString(),
    body: "Call agendada via dashboard Clique Boost.",
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// ponytail: .ics genérico funciona pra Apple Calendar e Outlook desktop (ambos abrem o arquivo
// direto), por isso não precisa de um terceiro link dedicado.
export function icsDataUrl(startMs: number, clientName: string): string {
  const { startMs: s, endMs: e } = callWindow(startMs);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clique Boost//Dashboard//PT",
    "BEGIN:VEVENT",
    `UID:${s}-${clientName.replace(/\s+/g, "")}@cliqueboost`,
    `DTSTAMP:${toUtcStamp(Date.now())}`,
    `DTSTART:${toUtcStamp(s)}`,
    `DTEND:${toUtcStamp(e)}`,
    `SUMMARY:Call ${clientName}, Clique Boost`,
    "DESCRIPTION:Call agendada via dashboard Clique Boost.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
