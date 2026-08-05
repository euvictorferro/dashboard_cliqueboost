import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientToken } from "@/lib/access";
import { fetchRecentMessages, deleteMessages } from "@/lib/chatMessages";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const messages = await fetchRecentMessages(clientId, 50);
    return Response.json({ messages });
  } catch (err) {
    console.error(`[booster-ai/messages] falha ao buscar histórico de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    await deleteMessages(clientId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[booster-ai/messages] falha ao limpar histórico de ${clientId}:`, err);
    return Response.json({ error: "delete_failed" }, { status: 502 });
  }
}
