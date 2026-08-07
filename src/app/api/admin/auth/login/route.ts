// src/app/api/admin/auth/login/route.ts
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { signAdminSession, ADMIN_SESSION_COOKIE_NAME, ADMIN_SESSION_COOKIE_MAX_AGE } from "@/lib/adminSession";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;
  if (typeof email !== "string" || typeof password !== "string") {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey || !process.env.ADMIN_SESSION_SECRET) {
    console.error("[admin-auth] SUPABASE_URL/SUPABASE_ANON_KEY/ADMIN_SESSION_SECRET não configurados");
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return Response.json({ error: "invalid_credentials" }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const withinLimit = await checkRateLimit(`admin-login:${ip}`, 900, 10);
  if (!withinLimit) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await anon.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  // Um cliente comum não pode logar no admin — precisa existir em admin_users.
  const { data: adminUser } = await admin
    .from("admin_users")
    .select("id, agency_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!adminUser) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE_NAME}=${signAdminSession(adminUser.id, adminUser.agency_id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ADMIN_SESSION_COOKIE_MAX_AGE}${
      process.env.NODE_ENV === "production" ? "; Secure; Domain=.cliqueboost.io" : ""
    }`
  );
  return response;
}
