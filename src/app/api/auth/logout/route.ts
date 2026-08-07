// src/app/api/auth/logout/route.ts
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return response;
}
