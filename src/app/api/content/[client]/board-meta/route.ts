import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchBoardLabels, fetchBoardMembers, hasTrelloCredentials } from "@/lib/trello";
import { verifyClientSession } from "@/lib/access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) {
    return Response.json({ error: "unknown client" }, { status: 404 });
  }
  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!client.trelloBoardId) {
    return Response.json({ error: "no_board_configured" }, { status: 404 });
  }
  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (board-meta)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  try {
    const [labels, members] = await Promise.all([
      fetchBoardLabels(client.trelloBoardId),
      fetchBoardMembers(client.trelloBoardId),
    ]);
    return Response.json({ labels, members });
  } catch (err) {
    console.error(`[content] falha ao buscar labels/membros do board pra ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
