import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchClientBoard, hasTrelloCredentials } from "@/lib/trello";
import { verifyClientSession } from "@/lib/access";
import { DEMO_CLIENT_ID, DEMO_CONTENT_LISTS } from "@/lib/demoData";

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
    return Response.json({ lists: DEMO_CONTENT_LISTS });
  }

  if (!client.trelloBoardId) {
    return Response.json({ error: "no_board_configured" }, { status: 404 });
  }
  if (!hasTrelloCredentials()) {
    // ponytail: distinto de "no_board_configured" — isso é config do ambiente (key/token
    // faltando), não do cliente. Mesma separação já aplicada na rota /api/tasks.
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  try {
    const lists = await fetchClientBoard(client.trelloBoardId);
    return Response.json({ lists });
  } catch (err) {
    // ponytail: qualquer erro da API do Trello cai num 502 — a página trata isso com uma
    // mensagem inline, sem fallback de mock (não existe mock natural pra isso).
    console.error(`[content] falha ao buscar board pra ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
