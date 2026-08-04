// src/lib/clientCalls.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export type ClientCall = { id: string; scheduledAt: number };

export async function fetchActiveCall(clientId: string): Promise<ClientCall | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_calls")
    .select("id, scheduled_at")
    .eq("client_id", clientId)
    .eq("status", "scheduled")
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: data.id, scheduledAt: Date.parse(data.scheduled_at) };
}

export async function createCall(clientId: string, scheduledAt: number, googleEventId: string): Promise<ClientCall> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_calls")
    .insert({
      client_id: clientId,
      scheduled_at: new Date(scheduledAt).toISOString(),
      google_event_id: googleEventId,
    })
    .select("id, scheduled_at")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, scheduledAt: Date.parse(data.scheduled_at) };
}

export async function cancelActiveCall(clientId: string): Promise<{ googleEventId: string } | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data: active, error: findError } = await supabase
    .from("client_calls")
    .select("id, google_event_id")
    .eq("client_id", clientId)
    .eq("status", "scheduled")
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!active) return null;

  const { error: updateError } = await supabase.from("client_calls").update({ status: "cancelled" }).eq("id", active.id);
  if (updateError) throw new Error(updateError.message);
  return { googleEventId: active.google_event_id };
}
