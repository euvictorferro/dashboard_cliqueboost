// ponytail: server-only — usa a Service Role Key via getSupabaseAdmin.
import { getSupabaseAdmin } from "./supabase";

// Rate limit genérico por chave (ex: "extract-tasks:cliente-x"). Retorna true se PODE seguir,
// false se estourou o limite. Fail-open: se a checagem der erro (banco fora etc), deixa passar —
// rate limit é proteção de custo, não de segurança, então não vale trancar o cliente fora.
export async function checkRateLimit(bucket: string, windowSeconds: number, max: number): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return true;
  const { data: hits, error } = await supabase.rpc("record_rate_hit", {
    p_bucket: bucket,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`[rateLimit] falha ao checar bucket ${bucket}:`, error);
    return true;
  }
  return typeof hits !== "number" || hits <= max;
}
