// src/lib/callNotes.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export type CallNote = {
  id: string;
  title: string;
  callAt: number;
  content: string;
  tasksExtractedAt: number | null;
};

export async function fetchCallNotes(clientId: string): Promise<CallNote[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("call_notes")
    .select("id, title, call_at, content, tasks_extracted_at")
    .eq("client_id", clientId)
    .order("call_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    callAt: Date.parse(row.call_at),
    content: row.content,
    tasksExtractedAt: row.tasks_extracted_at ? Date.parse(row.tasks_extracted_at) : null,
  }));
}

export async function fetchCallNote(clientId: string, id: string): Promise<CallNote | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("call_notes")
    .select("id, title, call_at, content, tasks_extracted_at")
    .eq("client_id", clientId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    callAt: Date.parse(data.call_at),
    content: data.content,
    tasksExtractedAt: data.tasks_extracted_at ? Date.parse(data.tasks_extracted_at) : null,
  };
}

export async function markTasksExtracted(clientId: string, noteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("call_notes")
    .update({ tasks_extracted_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("id", noteId);
  if (error) throw new Error(error.message);
}
