// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: number };

export async function fetchRecentMessages(clientId: string, limit: number): Promise<ChatMessage[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant",
      content: row.content,
      createdAt: Date.parse(row.created_at),
    }))
    .reverse();
}

export async function saveMessage(clientId: string, role: "user" | "assistant", content: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase.from("chat_messages").insert({ client_id: clientId, role, content });
  if (error) throw new Error(error.message);
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

function startOfTodayUtcMs(timeZone: string): number {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = dtf.formatToParts(now).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const naiveUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const offset = getTimeZoneOffsetMs(new Date(naiveUTC), timeZone);
  return naiveUTC - offset;
}

export async function countMessagesTodayInTimeZone(clientId: string, timeZone: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const since = new Date(startOfTodayUtcMs(timeZone)).toISOString();
  const { count, error } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("role", "user")
    .gte("created_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
