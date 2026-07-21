import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { CLIENTS } from "@/lib/clients";
import { getOrganicSnapshot, DATE_RANGES, type DateRangeId } from "@/lib/metrics";
import { getAudienceSnapshot } from "@/lib/audience";
import { fetchOrganicSnapshotLive, fetchAudienceSnapshotLive, hasMetaCredentials } from "@/lib/meta";
import { verifyClientToken } from "@/lib/access";
import { ReportDocument } from "@/lib/pdf-report";

function formatPeriod(days: number): string {
  const until = new Date();
  const since = new Date(until.getTime() - days * 86400000);
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
  return `${fmt.format(since)} – ${fmt.format(until)}`.replace(/\./g, "");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const range = (request.nextUrl.searchParams.get("range") ?? "30d") as DateRangeId;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const rangeInfo = DATE_RANGES.find((r) => r.id === range);
  if (!rangeInfo) {
    return Response.json({ error: "invalid range" }, { status: 400 });
  }

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) {
    return Response.json({ error: "unknown client" }, { status: 404 });
  }

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let organic = getOrganicSnapshot(clientId, range);
  let audience = getAudienceSnapshot(clientId, "this_month");

  if (client.instagramBusinessId && hasMetaCredentials()) {
    try {
      organic = await fetchOrganicSnapshotLive(client.instagramBusinessId, range);
    } catch (err) {
      console.error(`[report] organic live fetch falhou pra ${clientId}:`, err);
    }
    try {
      audience = await fetchAudienceSnapshotLive(client.instagramBusinessId, "this_month");
    } catch (err) {
      console.error(`[report] audience live fetch falhou pra ${clientId}:`, err);
    }
  }

  const buffer = await renderToBuffer(
    ReportDocument({ client, period: formatPeriod(rangeInfo.days), organic, audience })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-${clientId}.pdf"`,
    },
  });
}
