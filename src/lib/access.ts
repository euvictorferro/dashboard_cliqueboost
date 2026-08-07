import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE_NAME } from "./session";
import { verifyAdminSession, ADMIN_SESSION_COOKIE_NAME } from "./adminSession";

export async function verifyClientSession(clientId: string): Promise<boolean> {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  if (session?.clientId === clientId) return true;
  // Admin logado enxerga qualquer cliente (visão espelho — spec admin fase 1)
  const adminSession = verifyAdminSession(store.get(ADMIN_SESSION_COOKIE_NAME)?.value);
  return adminSession !== null;
}
