// src/app/api/conta/[client]/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchClientSettings, updateClientSettings } from "@/lib/clientSettings";
import { verifyClientToken } from "@/lib/access";
import { US_TIMEZONES } from "@/lib/clientTime";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const settings = await fetchClientSettings(clientId);
    return Response.json(settings);
  } catch (err) {
    console.error(`[conta] falha ao buscar configurações de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const timeZone = body?.timeZone;
  if (typeof timeZone !== "string" || !US_TIMEZONES.some((tz) => tz.value === timeZone)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await updateClientSettings(clientId, timeZone);
    return Response.json({ timeZone });
  } catch (err) {
    console.error(`[conta] falha ao salvar configurações de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
