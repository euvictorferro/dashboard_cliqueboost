// src/lib/session.ts
// ponytail: sessão própria (JWT HS256 caseiro via node:crypto), não a sessão do Supabase Auth —
// o app usa Service Role Key pra tudo, RLS por usuário não é usado em lugar nenhum, então a
// sessão completa do Supabase Auth (com refresh token, sync entre middleware/server/route
// handler via @supabase/ssr) não compra nada aqui. Upgrade se algum dia precisar de RLS de
// verdade por usuário: trocar por @supabase/ssr.
import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 dias

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurada");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSession(clientId: string, mustResetCredentials = false): string {
  const payload = JSON.stringify({
    clientId,
    mustResetCredentials,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });
  const encodedPayload = base64url(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySession(cookieValue: string | undefined): { clientId: string; mustResetCredentials: boolean } | null {
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
    if (typeof payload.clientId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    // ponytail: sessões assinadas antes desta flag existir não têm o campo — trata como
    // false (sem reset pendente) em vez de quebrar sessões já ativas.
    return { clientId: payload.clientId, mustResetCredentials: payload.mustResetCredentials === true };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "session";
export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE_SECONDS;
