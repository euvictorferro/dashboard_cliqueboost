import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { getAudienceSnapshot, AUDIENCE_TIMEFRAMES, type AudienceTimeframeId } from "@/lib/audience";
import { fetchAudienceSnapshotLive, hasMetaCredentials } from "@/lib/meta";
import { verifyClientSession } from "@/lib/access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const timeframe = (request.nextUrl.searchParams.get("timeframe") ?? "this_month") as AudienceTimeframeId;

  if (!AUDIENCE_TIMEFRAMES.some((t) => t.id === timeframe)) {
    return Response.json({ error: "invalid timeframe" }, { status: 400 });
  }

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) {
    return Response.json({ error: "unknown client" }, { status: 404 });
  }

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (client.instagramBusinessId && hasMetaCredentials()) {
    try {
      const snapshot = await fetchAudienceSnapshotLive(client.instagramBusinessId, timeframe);
      return Response.json({ ...snapshot, source: "live" });
    } catch (err) {
      // ponytail: qualquer erro da Graph API cai pro mock — nunca quebra o dashboard do cliente.
      console.error(`[audience] live fetch falhou pra ${clientId}:`, err);
    }
  }

  return Response.json({ ...getAudienceSnapshot(clientId, timeframe), source: "mock" });
}
