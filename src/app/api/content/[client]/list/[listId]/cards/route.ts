import { NextRequest } from "next/server";
import { createCard, hasTrelloCredentials } from "@/lib/trello";
import { verifyClientSession } from "@/lib/access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; listId: string }> },
) {
  const { client: clientId, listId } = await params;

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (create card)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { name, listName } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const card = await createCard(listId, name.trim(), typeof listName === "string" ? listName : "");
    return Response.json({ card });
  } catch (err) {
    console.error(`[content] falha ao criar card na lista ${listId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
