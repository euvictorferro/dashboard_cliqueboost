import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchListMeta, hasClickUpCredentials } from "@/lib/clickup";
import { verifyClientSession } from "@/lib/access";
import { DEMO_CLIENT_ID, DEMO_TASK_STATUSES, DEMO_TASK_MEMBERS } from "@/lib/demoData";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) {
    return Response.json({ error: "unknown client" }, { status: 404 });
  }
  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (clientId === DEMO_CLIENT_ID) {
    return Response.json({ statuses: DEMO_TASK_STATUSES, members: DEMO_TASK_MEMBERS });
  }

  if (!client.clickupListId) {
    return Response.json({ error: "no_list_configured" }, { status: 404 });
  }
  if (!hasClickUpCredentials()) {
    console.error("[tasks] CLICKUP_API_TOKEN não configurado (list-meta)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  try {
    const meta = await fetchListMeta(client.clickupListId);
    return Response.json(meta);
  } catch (err) {
    console.error(`[tasks] falha ao buscar status/membros da lista pra ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
