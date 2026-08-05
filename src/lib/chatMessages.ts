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

export async function deleteMessages(clientId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase.from("chat_messages").delete().eq("client_id", clientId);
  if (error) throw new Error(error.message);
}

export async function saveMessage(clientId: string, role: "user" | "assistant", content: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase.from("chat_messages").insert({ client_id: clientId, role, content });
  if (error) throw new Error(error.message);
}

function todayDateStringInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date()
  );
}

export async function incrementDailyUsage(clientId: string, timeZone: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const day = todayDateStringInTimeZone(timeZone);
  const { data, error } = await supabase.rpc("increment_chat_usage", { p_client_id: clientId, p_day: day });
  if (error) throw new Error(error.message);
  return data as number;
}
