// src/lib/callNotes.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export type CallNote = { id: string; title: string; callDate: string; content: string };

export async function fetchCallNotes(clientId: string): Promise<CallNote[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("call_notes")
    .select("id, title, call_date, content")
    .eq("client_id", clientId)
    .order("call_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    callDate: row.call_date,
    content: row.content,
  }));
}
