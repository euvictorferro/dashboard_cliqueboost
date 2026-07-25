import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchCompetitors, fetchCompetitorProfile } from "@/lib/competitors";
import { verifyClientToken } from "@/lib/access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; competitorId: string }> },
) {
  const { client: clientId, competitorId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const competitors = await fetchCompetitors(clientId);
    const competitor = competitors.find((c) => c.id === competitorId);
    if (!competitor) return Response.json({ error: "not_found" }, { status: 404 });
    const profile = await fetchCompetitorProfile(competitor);
    return Response.json(profile);
  } catch (err) {
    console.error(`[competitors] falha ao buscar perfil de ${competitorId} (${clientId}):`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
