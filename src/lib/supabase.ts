import { createClient } from "@supabase/supabase-js";

// ponytail: server-only — usa a Service Role Key, nunca importar de um componente "use client".
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
