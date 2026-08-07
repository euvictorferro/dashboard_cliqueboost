import { cookies } from "next/headers";
import { getSupabaseAdmin } from "./supabase";
import { verifySession, SESSION_COOKIE_NAME } from "./session";

// ponytail: server-only. Sem Supabase configurado, nega acesso por padrão (fail closed).
export async function verifyClientToken(clientId: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { data } = await supabase.from("client_tokens").select("token").eq("client_id", clientId).maybeSingle();
  return Boolean(data && data.token === token);
}

export async function verifyClientSession(clientId: string): Promise<boolean> {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  return session?.clientId === clientId;
}
