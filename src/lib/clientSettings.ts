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
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

const CLIENT_SETTINGS_COLUMNS =
  "time_zone, logo_url, contract_start_date, contact_email, plan_name, payment_status, stripe_customer_id, stripe_subscription_id";

function mapClientSettingsRow(data: {
  time_zone?: string | null;
  logo_url?: string | null;
  contract_start_date?: string | null;
  contact_email?: string | null;
  plan_name?: string | null;
  payment_status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
} | null): ClientSettings {
  return {
    timeZone: data?.time_zone ?? DEFAULT_TIME_ZONE,
    logoUrl: data?.logo_url ?? null,
    contractStart: data?.contract_start_date ?? null,
    contactEmail: data?.contact_email ?? null,
    planName: data?.plan_name ?? null,
    paymentStatus: data?.payment_status ?? null,
    stripeCustomerId: data?.stripe_customer_id ?? null,
    stripeSubscriptionId: data?.stripe_subscription_id ?? null,
  };
}

export async function fetchClientSettings(clientId: string): Promise<ClientSettings> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_settings")
    .select(CLIENT_SETTINGS_COLUMNS)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return mapClientSettingsRow(data);
}

export async function fetchClientIdByStripeCustomerId(stripeCustomerId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_settings")
    .select("client_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.client_id ?? null;
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
