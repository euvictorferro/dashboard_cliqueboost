// src/app/api/admin/auth/logout/route.ts
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/adminSession";

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
      process.env.NODE_ENV === "production" ? "; Secure; Domain=.cliqueboost.io" : ""
    }`
  );
  return response;
}
