import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchClientTasks, fetchListMeta, hasClickUpCredentials } from "@/lib/clickup";
import { verifyClientSession } from "@/lib/access";
import { DEMO_CLIENT_ID, DEMO_TASKS, DEMO_TASK_STATUSES } from "@/lib/demoData";

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
    return Response.json({ tasks: DEMO_TASKS, statuses: DEMO_TASK_STATUSES });
  }

  if (!client.clickupListId) {
    return Response.json({ error: "no_list_configured" }, { status: 404 });
  }
  if (!hasClickUpCredentials()) {
    // ponytail: distinto de "no_list_configured" — isso é config do ambiente (token faltando),
    // não do cliente. Sem essa separação, um token ausente aparentava ser problema de todo cliente.
    console.error("[tasks] CLICKUP_API_TOKEN não configurado");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  try {
    const [tasks, meta] = await Promise.all([fetchClientTasks(client.clickupListId), fetchListMeta(client.clickupListId)]);
    return Response.json({ tasks, statuses: meta.statuses });
  } catch (err) {
    // ponytail: qualquer erro da API do ClickUp cai num 502 — a página trata isso com uma
    // mensagem inline, sem fallback de mock (não existe mock natural pra tarefas).
    console.error(`[tasks] falha ao buscar tasks pra ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
