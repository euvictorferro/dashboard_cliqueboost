import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { deleteCompetitor } from "@/lib/competitors";
import { verifyClientSession } from "@/lib/access";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; competitorId: string }> },
) {
  const { client: clientId, competitorId } = await params;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    await deleteCompetitor(clientId, competitorId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[competitors] falha ao excluir concorrente ${competitorId} de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
