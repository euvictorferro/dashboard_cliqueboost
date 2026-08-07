// src/app/api/auth/login/route.ts
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { signSession, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;
  if (typeof email !== "string" || typeof password !== "string") {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey || !process.env.SESSION_SECRET) {
    console.error("[auth] SUPABASE_URL/SUPABASE_ANON_KEY/SESSION_SECRET não configurados");
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await anon.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return Response.json({ error: "invalid_credentials" }, { status: 401 });

  const { data: account } = await admin
    .from("client_accounts")
    .select("client_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!account) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const response = Response.json({ clientId: account.client_id });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${signSession(account.client_id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
  return response;
}
