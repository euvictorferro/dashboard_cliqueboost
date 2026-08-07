import { NextRequest } from "next/server";
import { addLabelToCard, hasTrelloCredentials, removeLabelFromCard } from "@/lib/trello";
import { verifyClientSession } from "@/lib/access";

async function auth(clientId: string) {
  if (!(await verifyClientSession(clientId))) return { error: "unauthorized" as const, status: 401 };
  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (labels)");
    return { error: "fetch_failed" as const, status: 502 };
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> },
) {
  const { client: clientId, cardId } = await params;
  const authError = await auth(clientId);
  if (authError) return Response.json({ error: authError.error }, { status: authError.status });

  const { labelId } = await request.json();
  if (typeof labelId !== "string") return Response.json({ error: "invalid_body" }, { status: 400 });

  try {
    await addLabelToCard(cardId, labelId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[content] falha ao adicionar label no card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> },
) {
  const { client: clientId, cardId } = await params;
  const authError = await auth(clientId);
  if (authError) return Response.json({ error: authError.error }, { status: authError.status });

  const { labelId } = await request.json();
  if (typeof labelId !== "string") return Response.json({ error: "invalid_body" }, { status: 400 });

  try {
    await removeLabelFromCard(cardId, labelId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[content] falha ao remover label do card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
