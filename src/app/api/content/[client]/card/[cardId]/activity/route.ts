import { NextRequest } from "next/server";
import { addComment, fetchCardActivity, hasTrelloCredentials } from "@/lib/trello";
import { verifyClientToken } from "@/lib/access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> },
) {
  const { client: clientId, cardId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
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
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (comment)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { text } = await request.json();
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "invalid_text" }, { status: 400 });
  }

  try {
    const activity = await addComment(cardId, text.trim());
    return Response.json({ activity });
  } catch (err) {
    console.error(`[content] falha ao comentar no card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
