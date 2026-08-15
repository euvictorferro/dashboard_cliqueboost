import { NextRequest } from "next/server";
import { hasTrelloCredentials, updateDescription } from "@/lib/trello";
import { verifyClientSession } from "@/lib/access";
import { DEMO_CLIENT_ID } from "@/lib/demoData";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> },
) {
  const { client: clientId, cardId } = await params;

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (clientId === DEMO_CLIENT_ID) {
    return Response.json({ ok: true });
  }
  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (description)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { desc } = await request.json();
  if (typeof desc !== "string") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await updateDescription(cardId, desc);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[content] falha ao editar descrição do card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
