// src/lib/googleCalendar.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a chave da service account).
import { createSign } from "node:crypto";

const SLOT_MINUTES = 30;
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 17;
const TIME_ZONE = "America/New_York";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function getServiceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY não configurada");
  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY inválida");
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

async function getAccessToken(): Promise<string> {
  const { client_email, private_key } = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: client_email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(private_key, "base64url");
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google_auth_failed: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

function calendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error("GOOGLE_CALENDAR_ID não configurada");
  return id;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - date.getTime();
}

function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number {
  const naiveUTC = Date.UTC(year, month, day, hour, minute);
  const offset = getTimeZoneOffsetMs(new Date(naiveUTC), timeZone);
  return naiveUTC - offset;
}

function candidateSlots(daysAhead: number): number[] {
  const slots: number[] = [];
  const now = new Date();
  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) continue; // fim de semana fora
    for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
        const slotMs = zonedTimeToUtc(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, TIME_ZONE);
        if (slotMs > now.getTime()) slots.push(slotMs);
      }
    }
  }
  return slots;
}

export async function fetchFreeSlots(daysAhead: number): Promise<number[]> {
  const accessToken = await getAccessToken();
  const candidates = candidateSlots(daysAhead);
  if (candidates.length === 0) return [];

  const timeMin = new Date(candidates[0]).toISOString();
  const timeMax = new Date(candidates[candidates.length - 1] + SLOT_MINUTES * 60_000).toISOString();

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId() }] }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google_freebusy_failed: ${JSON.stringify(json)}`);

  const busy: { start: string; end: string }[] = json.calendars?.[calendarId()]?.busy ?? [];
  const busyRanges = busy.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));

  return candidates.filter((slotStart) => {
    const slotEnd = slotStart + SLOT_MINUTES * 60_000;
    return !busyRanges.some((b) => slotStart < b.end && slotEnd > b.start);
  });
}

export async function createCallEvent(startMs: number, description: string): Promise<string> {
  const accessToken = await getAccessToken();
  const endMs = startMs + SLOT_MINUTES * 60_000;
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: "Call — Clique Boost",
      description,
      start: { dateTime: new Date(startMs).toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: new Date(endMs).toISOString(), timeZone: TIME_ZONE },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google_create_event_failed: ${JSON.stringify(json)}`);
  return json.id as string;
}

export async function cancelCallEvent(eventId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok && res.status !== 410) {
    const text = await res.text();
    throw new Error(`google_cancel_event_failed: ${text}`);
  }
}
