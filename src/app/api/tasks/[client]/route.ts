// src/app/api/tasks/[client]/route.ts
import { CLIENTS } from "@/lib/clients";
import { verifyClientSession } from "@/lib/access";
import { listTasksForClient, listStatuses } from "@/lib/tasks";

// ponytail: agencyId fixo — única agência hoje (Clique Boost); vira dinâmico na virada multi-tenant.
const AGENCY_ID = "cliqueboost";

export async function GET(_request: Request, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const found = CLIENTS.find((c) => c.id === clientId);
  if (!found) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [tasks, statuses] = await Promise.all([listTasksForClient(clientId), listStatuses(AGENCY_ID)]);
  return Response.json({ tasks, statuses });
}
