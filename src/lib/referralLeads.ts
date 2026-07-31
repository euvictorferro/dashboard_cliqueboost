// src/lib/referralLeads.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export type ReferralLead = { id: string; name: string; contact: string; createdAt: string };

export async function fetchReferralLeads(clientId: string): Promise<ReferralLead[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("referral_leads")
    .select("id, name, contact, created_at")
    .eq("referrer_client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, contact: row.contact, createdAt: row.created_at }));
}

export async function createReferralLead(referrerClientId: string, name: string, contact: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("referral_leads")
    .insert({ referrer_client_id: referrerClientId, name, contact });
  if (error) throw new Error(error.message);
}
