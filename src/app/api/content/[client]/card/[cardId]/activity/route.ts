import { NextRequest } from "next/server";
import { addComment, fetchCardActivity, hasTrelloCredentials } from "@/lib/trello";
import { verifyClientSession } from "@/lib/access";
import { DEMO_CLIENT_ID, DEMO_CARD_ACTIVITY } from "@/lib/demoData";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> },
) {
  const { client: clientId, cardId } = await params;

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (clientId === DEMO_CLIENT_ID) {
    return Response.json({ activity: DEMO_CARD_ACTIVITY });
  }

  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (activity)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  try {
    const activity = await fetchCardActivity(cardId);
    return Response.json({ activity });
  } catch (err) {
    console.error(`[content] falha ao buscar atividade do card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> },
) {
  const { client: clientId, cardId } = await params;

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { text } = await request.json();
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "invalid_text" }, { status: 400 });
  }

  if (clientId === DEMO_CLIENT_ID) {
    // ponytail: não persiste — só devolve o comentário pra UI reagir na hora, some no reload.
    return Response.json({
      activity: {
        id: `demo-activity-${Date.now()}`,
        date: Date.now(),
        authorName: "Você",
        authorAvatarUrl: null,
        authorInitials: "VC",
        kind: "comment",
        text: text.trim(),
        textAfter: null,
        attachmentRef: null,
        isCreation: false,
      },
    });
  }

  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (comment)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  try {
    const activity = await addComment(cardId, text.trim());
    return Response.json({ activity });
  } catch (err) {
    console.error(`[content] falha ao comentar no card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
