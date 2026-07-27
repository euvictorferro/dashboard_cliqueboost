// src/app/api/atas/[client]/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchCallNotes } from "@/lib/callNotes";
import { verifyClientToken } from "@/lib/access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const notes = await fetchCallNotes(clientId);
    return Response.json({ notes });
  } catch (err) {
    console.error(`[atas] falha ao buscar atas de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
