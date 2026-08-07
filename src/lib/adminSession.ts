// src/lib/adminSession.ts
// ponytail: mesmo mecanismo de src/lib/session.ts (HMAC-SHA256 caseiro via node:crypto),
// copiado e não importado — secret e payload distintos (admin vs cliente), sessões não se misturam.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const ADMIN_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 dias

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET não configurada");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signAdminSession(adminUserId: string, agencyId: string): string {
  const payload = JSON.stringify({
    adminUserId,
    agencyId,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  const encodedPayload = base64url(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSession(
  cookieValue: string | undefined
): { adminUserId: string; agencyId: string } | null {
  if (!cookieValue) return null;
  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) return null;

  let expectedSignature: string;
  try {
    expectedSignature = sign(encodedPayload);
  } catch {
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (typeof payload.adminUserId !== "string" || typeof payload.agencyId !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { adminUserId: payload.adminUserId, agencyId: payload.agencyId };
  } catch {
    return null;
  }
}

export const ADMIN_SESSION_COOKIE_NAME = "admin_session";
export const ADMIN_SESSION_COOKIE_MAX_AGE = ADMIN_SESSION_MAX_AGE_SECONDS;

export async function verifyAdminRequest(): Promise<{ adminUserId: string; agencyId: string } | null> {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_SESSION_COOKIE_NAME)?.value);
}
