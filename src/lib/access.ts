import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE_NAME } from "./session";

export async function verifyClientSession(clientId: string): Promise<boolean> {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  return session?.clientId === clientId;
}
