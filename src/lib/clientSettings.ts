// src/lib/clientSettings.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";
import { DEFAULT_TIME_ZONE } from "./clientTime";

export type ClientSettings = {
  timeZone: string;
  logoUrl: string | null;
  contractStart: string | null;
  contactEmail: string | null;
  planName: string | null;
  paymentStatus: string | null;
};

export async function fetchClientSettings(clientId: string): Promise<ClientSettings> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_settings")
    .select("time_zone, logo_url, contract_start_date, contact_email, plan_name, payment_status")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    timeZone: data?.time_zone ?? DEFAULT_TIME_ZONE,
    logoUrl: data?.logo_url ?? null,
    contractStart: data?.contract_start_date ?? null,
    contactEmail: data?.contact_email ?? null,
    planName: data?.plan_name ?? null,
    paymentStatus: data?.payment_status ?? null,
  };
}

export async function updateContactEmail(clientId: string, email: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("client_settings")
    .upsert({ client_id: clientId, contact_email: email }, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}

export async function updateClientSettings(clientId: string, timeZone: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("client_settings")
    .upsert({ client_id: clientId, time_zone: timeZone }, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}

export async function updateClientLogo(clientId: string, logoUrl: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("client_settings")
    .upsert({ client_id: clientId, logo_url: logoUrl }, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}
