// src/lib/clientSettings.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";
import { DEFAULT_TIME_ZONE } from "./clientTime";

export type ClientSettings = { timeZone: string; brandColor: string | null; logoUrl: string | null };

export async function fetchClientSettings(clientId: string): Promise<ClientSettings> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_settings")
    .select("time_zone, brand_color, logo_url")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    timeZone: data?.time_zone ?? DEFAULT_TIME_ZONE,
    brandColor: data?.brand_color ?? null,
    logoUrl: data?.logo_url ?? null,
  };
}

export async function updateClientSettings(clientId: string, timeZone: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("client_settings")
    .upsert({ client_id: clientId, time_zone: timeZone }, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}

// ponytail: upsert parcial — só grava as colunas passadas, não mexe em time_zone/logo_url quando
// só a cor é enviada (Postgres ON CONFLICT DO UPDATE SET só atualiza as colunas do payload).
export async function updateClientBrand(
  clientId: string,
  brand: { brandColor?: string; logoUrl?: string }
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const patch: Record<string, string> = { client_id: clientId };
  if (brand.brandColor !== undefined) patch.brand_color = brand.brandColor;
  if (brand.logoUrl !== undefined) patch.logo_url = brand.logoUrl;
  const { error } = await supabase.from("client_settings").upsert(patch, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}
