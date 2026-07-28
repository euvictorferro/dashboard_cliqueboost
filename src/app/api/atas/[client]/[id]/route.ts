// src/app/api/atas/[client]/[id]/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchCallNote } from "@/lib/callNotes";
import { verifyClientToken } from "@/lib/access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string; id: string }> }) {
  const { client: clientId, id } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const note = await fetchCallNote(clientId, id);
    if (!note) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ note });
  } catch (err) {
    console.error(`[atas] falha ao buscar ata ${id} de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
