// src/app/api/auth/onboarding/route.ts
// Marca o tour de onboarding como visto (concluído ou pulado) — persiste no banco e re-assina
// o cookie de sessão (mesmo padrão de /api/auth/update-credentials para must_reset_credentials).
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifySession, signSession, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from "@/lib/session";

export async function POST() {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin
      .from("client_accounts")
      .update({ has_seen_onboarding: true })
      .eq("client_id", session.clientId);
    // ponytail: se a coluna ainda não existir (migration não rodou), segue sem travar o
    // cliente — a flag só não vai persistir entre sessões até a migration rodar.
    if (error) console.error(`[onboarding] falha ao marcar ${session.clientId} como visto:`, error.message);
  }

  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${signSession(session.clientId, session.mustResetCredentials, true)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
  return response;
}
