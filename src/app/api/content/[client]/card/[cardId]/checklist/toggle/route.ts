import { NextRequest } from "next/server";
import { hasTrelloCredentials, setChecklistItemState } from "@/lib/trello";
import { verifyClientToken } from "@/lib/access";

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
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (checklist toggle)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { checkItemId, checked } = await request.json();
  if (typeof checkItemId !== "string" || typeof checked !== "boolean") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await setChecklistItemState(cardId, checkItemId, checked);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[content] falha ao marcar item da checklist no card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
