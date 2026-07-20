import { getSupabaseAdmin } from "./supabase";

// ponytail: server-only. Sem Supabase configurado, nega acesso por padrão (fail closed).
export async function verifyClientToken(clientId: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { data } = await supabase.from("client_tokens").select("token").eq("client_id", clientId).maybeSingle();
  return Boolean(data && data.token === token);
}
