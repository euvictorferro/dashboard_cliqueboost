// src/app/api/conta/[client]/brand/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { updateClientBrand } from "@/lib/clientSettings";
import { verifyClientToken } from "@/lib/access";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export async function PUT(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const brandColor = body?.brandColor;
  if (typeof brandColor !== "string" || !HEX_COLOR_PATTERN.test(brandColor)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await updateClientBrand(clientId, { brandColor });
    return Response.json({ brandColor });
  } catch (err) {
    console.error(`[conta] falha ao salvar cor de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
