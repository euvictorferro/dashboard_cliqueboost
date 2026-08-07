// src/app/api/admin/auth/google/route.ts
// ponytail: fluxo iniciado 100% server-side (GET ?start=1 gera a URL do OAuth e redireciona) —
// evita expor SUPABASE_URL/ANON_KEY como NEXT_PUBLIC_ só pra isso.
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { signAdminSession, ADMIN_SESSION_COOKIE_NAME, ADMIN_SESSION_COOKIE_MAX_AGE } from "@/lib/adminSession";

export async function GET(request: Request) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return Response.redirect(new URL("/admin/login?error=google_nao_configurado", request.url));
  }
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { searchParams, origin } = new URL(request.url);

  // Callback do OAuth: troca o code por sessão e valida contra admin_users.
  const code = searchParams.get("code");
  if (code) {
    const { data, error } = await anon.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      return Response.redirect(new URL("/admin/login?error=google_falhou", request.url));
    }

    const admin = getSupabaseAdmin();
    const adminUser = admin
      ? (await admin.from("admin_users").select("id, agency_id").eq("user_id", data.user.id).maybeSingle()).data
      : null;
    if (!adminUser) {
      return Response.redirect(new URL("/admin/login?error=nao_autorizado", request.url));
    }

    const response = Response.redirect(new URL("/admin/clientes", request.url));
    response.headers.append(
      "Set-Cookie",
      `${ADMIN_SESSION_COOKIE_NAME}=${signAdminSession(adminUser.id, adminUser.agency_id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ADMIN_SESSION_COOKIE_MAX_AGE}${
        process.env.NODE_ENV === "production" ? "; Secure; Domain=.cliqueboost.io" : ""
      }`
    );
    return response;
  }

  // Início do fluxo: gera a URL do Google e redireciona.
  const { data, error } = await anon.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/api/admin/auth/google`, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    return Response.redirect(new URL("/admin/login?error=google_nao_configurado", request.url));
  }
  return Response.redirect(data.url);
}
