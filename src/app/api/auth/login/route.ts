// src/app/api/auth/login/route.ts
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { signSession, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from "@/lib/session";

// Anti brute force: no máximo 10 tentativas por IP a cada 15 min.
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;
  const rememberMe = body?.rememberMe !== false;
  if (typeof email !== "string" || typeof password !== "string") {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey || !process.env.SESSION_SECRET) {
    console.error("[auth] SUPABASE_URL/SUPABASE_ANON_KEY/SESSION_SECRET não configurados");
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return Response.json({ error: "invalid_credentials" }, { status: 401 });

  // Vercel popula x-forwarded-for; o primeiro IP é o do cliente. Sem header (ambiente estranho),
  // cai num balde único "unknown" — conservador, mas nunca deixa de limitar.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const { data: attempts, error: rlError } = await admin.rpc("record_login_attempt", {
    p_ip: ip,
    p_window_seconds: LOGIN_WINDOW_SECONDS,
  });
  // Fail-closed só se a checagem der erro de verdade; se passar do limite, 429.
  if (rlError) {
    console.error("[auth] falha no rate limit de login:", rlError);
  } else if (typeof attempts === "number" && attempts > LOGIN_MAX_ATTEMPTS) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await anon.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { data: account } = await admin
    .from("client_accounts")
    .select("client_id, must_reset_credentials")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!account) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  // ponytail: busca separada e best-effort — se a coluna has_seen_onboarding ainda não existir
  // (migration 0027 não rodou), login continua funcionando normalmente, só sem o tour.
  const { data: onboarding } = await admin
    .from("client_accounts")
    .select("has_seen_onboarding")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  const hasSeenOnboarding = onboarding?.has_seen_onboarding === true;

  const response = Response.json({ clientId: account.client_id, mustResetCredentials: account.must_reset_credentials });
  // rememberMe=false: cookie de sessão do navegador (some ao fechar), sem Max-Age.
  // O exp de 7 dias dentro do JWT continua sendo a trava real no servidor.
  const maxAge = rememberMe ? `; Max-Age=${SESSION_COOKIE_MAX_AGE}` : "";
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${signSession(account.client_id, account.must_reset_credentials, hasSeenOnboarding)}; Path=/; HttpOnly; SameSite=Lax${maxAge}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
  return response;
}
