import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { getOrganicSnapshot, DATE_RANGES, type DateRangeId } from "@/lib/metrics";
import { fetchOrganicSnapshotLive, hasMetaCredentials } from "@/lib/meta";
import { verifyClientToken } from "@/lib/access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const range = (request.nextUrl.searchParams.get("range") ?? "30d") as DateRangeId;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!DATE_RANGES.some((r) => r.id === range)) {
    return Response.json({ error: "invalid range" }, { status: 400 });
  }

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) {
    return Response.json({ error: "unknown client" }, { status: 404 });
  }

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (client.instagramBusinessId && hasMetaCredentials()) {
    try {
      const snapshot = await fetchOrganicSnapshotLive(client.instagramBusinessId, range);
      return Response.json({ ...snapshot, source: "live" });
    } catch (err) {
      // ponytail: qualquer erro da Graph API cai pro mock — nunca quebra o dashboard do cliente.
      console.error(`[organic] live fetch falhou pra ${clientId}:`, err);
    }
  }

  return Response.json({ ...getOrganicSnapshot(clientId, range), source: "mock" });
}
