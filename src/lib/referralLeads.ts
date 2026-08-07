// src/lib/referralLeads.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

// Status do ponto de vista do indicador:
// pending → indicou, ainda não virou cliente | converted → virou cliente, aguardando 1º pagamento
// rewarded → desconto de 20% aplicado | disqualified → 1º pagamento abaixo do plano mínimo
export type ReferralStatus = "pending" | "converted" | "rewarded" | "disqualified";
export type ReferralLead = { id: string; name: string; contact: string; createdAt: string; status: ReferralStatus };

export async function fetchReferralLeads(clientId: string): Promise<ReferralLead[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("referral_leads")
    .select("id, name, contact, created_at, converted_client_id, discount_applied_at, disqualified_at")
    .eq("referrer_client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    contact: row.contact,
    createdAt: row.created_at,
    status: row.discount_applied_at
      ? "rewarded"
      : row.disqualified_at
        ? "disqualified"
        : row.converted_client_id
          ? "converted"
          : "pending",
  }));
}

export type AdminReferralLead = ReferralLead & { referrerClientId: string; convertedClientId: string | null };

export async function fetchAllReferralLeads(): Promise<AdminReferralLead[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("referral_leads")
    .select("id, name, contact, created_at, referrer_client_id, converted_client_id, discount_applied_at, disqualified_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    contact: row.contact,
    createdAt: row.created_at,
    referrerClientId: row.referrer_client_id,
    convertedClientId: row.converted_client_id,
    status: row.discount_applied_at
      ? "rewarded"
      : row.disqualified_at
        ? "disqualified"
        : row.converted_client_id
          ? "converted"
          : "pending",
  }));
}

export async function markConverted(leadId: string, convertedClientId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data: lead, error: fetchError } = await supabase
    .from("referral_leads")
    .select("discount_applied_at")
    .eq("id", leadId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!lead) throw new Error("lead_nao_encontrado");
  if (lead.discount_applied_at) throw new Error("lead_ja_premiado");

  const { error } = await supabase
    .from("referral_leads")
    .update({ converted_client_id: convertedClientId })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
}

export async function createReferralLead(referrerClientId: string, name: string, contact: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("referral_leads")
    .insert({ referrer_client_id: referrerClientId, name, contact });
  if (error) throw new Error(error.message);
}

export async function findPendingConversion(convertedClientId: string): Promise<{ id: string; referrerClientId: string } | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("referral_leads")
    .select("id, referrer_client_id")
    .eq("converted_client_id", convertedClientId)
    .is("discount_applied_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: data.id, referrerClientId: data.referrer_client_id } : null;
}

export async function markDiscountApplied(leadId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("referral_leads")
    .update({ discount_applied_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
}

export async function markDisqualified(leadId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("referral_leads")
    .update({ disqualified_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
}
