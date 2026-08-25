// src/app/api/auth/update-credentials/route.ts
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifySession, signSession, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from "@/lib/session";

export async function POST(request: Request) {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "email_invalido" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return Response.json({ error: "senha_invalida" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });

  const { data: account } = await admin
    .from("client_accounts")
    .select("user_id")
    .eq("client_id", session.clientId)
    .maybeSingle();
  if (!account) return Response.json({ error: "conta_nao_encontrada" }, { status: 404 });

  const { error: updateError } = await admin.auth.admin.updateUserById(account.user_id, {
    email,
    password,
    email_confirm: true,
  });
  if (updateError) {
    return Response.json({ error: "falha_atualizar_credenciais", detail: updateError.message }, { status: 500 });
  }

  const { error: flagError } = await admin
    .from("client_accounts")
    .update({ must_reset_credentials: false })
    .eq("user_id", account.user_id);
  if (flagError) {
    return Response.json({ error: "falha_atualizar_flag", detail: flagError.message }, { status: 500 });
  }

  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${signSession(session.clientId, false, session.hasSeenOnboarding)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
  return response;
}
