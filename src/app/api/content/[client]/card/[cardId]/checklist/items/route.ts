import { NextRequest } from "next/server";
import { addChecklistItem, deleteChecklistItem, hasTrelloCredentials } from "@/lib/trello";
import { verifyClientSession } from "@/lib/access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> },
) {
  const { client: clientId } = await params;

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (checklist add item)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { checklistId, name } = await request.json();
  if (typeof checklistId !== "string" || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const item = await addChecklistItem(checklistId, name.trim());
    return Response.json({ item });
  } catch (err) {
    console.error(`[content] falha ao adicionar item na checklist ${checklistId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> },
) {
  const { client: clientId } = await params;

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (checklist delete item)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { checklistId, checkItemId } = await request.json();
  if (typeof checklistId !== "string" || typeof checkItemId !== "string") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await deleteChecklistItem(checklistId, checkItemId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[content] falha ao remover item da checklist ${checklistId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
