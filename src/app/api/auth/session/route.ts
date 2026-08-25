// src/app/api/auth/session/route.ts
// ponytail: só o suficiente pro AppFrame decidir se mostra o popup de troca de credenciais e
// o tour de onboarding — não devolve mais nada da sessão de propósito.
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET() {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ mustResetCredentials: session.mustResetCredentials, hasSeenOnboarding: session.hasSeenOnboarding });
}
