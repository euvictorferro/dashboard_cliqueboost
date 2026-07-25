import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchCompetitors, addCompetitor } from "@/lib/competitors";
import { verifyClientToken } from "@/lib/access";

const VALID_PLATFORMS = ["instagram", "tiktok", "linkedin"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const competitors = await fetchCompetitors(clientId);
    return Response.json({ competitors });
  } catch (err) {
    console.error(`[competitors] falha ao buscar concorrentes de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const handle = typeof body?.handle === "string" ? body.handle.trim() : "";
  const platform = body?.platform;
  if (!handle || !VALID_PLATFORMS.includes(platform)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const competitor = await addCompetitor(clientId, handle, platform);
    return Response.json({ competitor });
  } catch (err) {
    console.error(`[competitors] falha ao adicionar concorrente pra ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
