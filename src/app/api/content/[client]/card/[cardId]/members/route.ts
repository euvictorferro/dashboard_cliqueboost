import { NextRequest } from "next/server";
import { addMemberToCard, hasTrelloCredentials, removeMemberFromCard } from "@/lib/trello";
import { verifyClientSession } from "@/lib/access";

async function auth(clientId: string) {
  if (!(await verifyClientSession(clientId))) return { error: "unauthorized" as const, status: 401 };
  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (members)");
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

  const { memberId } = await request.json();
  if (typeof memberId !== "string") return Response.json({ error: "invalid_body" }, { status: 400 });

  try {
    await addMemberToCard(cardId, memberId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[content] falha ao adicionar membro no card ${cardId}:`, err);
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

  const { memberId } = await request.json();
  if (typeof memberId !== "string") return Response.json({ error: "invalid_body" }, { status: 400 });

  try {
    await removeMemberFromCard(cardId, memberId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[content] falha ao remover membro do card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
