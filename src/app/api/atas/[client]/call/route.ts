import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientToken } from "@/lib/access";
import { fetchActiveCall, createCall, findActiveCallToCancel, cancelCallById } from "@/lib/clientCalls";
import { fetchFreeSlots, createCallEvent, cancelCallEvent } from "@/lib/googleCalendar";

const DAYS_AHEAD = 10;

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const [activeCall, freeSlots] = await Promise.all([fetchActiveCall(clientId), fetchFreeSlots(DAYS_AHEAD)]);
    return Response.json({ activeCall, freeSlots });
  } catch (err) {
    console.error(`[atas/call] falha ao buscar disponibilidade de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const scheduledAt = body?.scheduledAt;
  if (typeof scheduledAt !== "number" || scheduledAt <= Date.now()) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const previousActive = await findActiveCallToCancel(clientId);

    const googleEventId = await createCallEvent(scheduledAt, client.name);
    const call = await createCall(clientId, scheduledAt, googleEventId);

    if (previousActive) {
      try {
        await cancelCallEvent(previousActive.googleEventId);
        await cancelCallById(previousActive.id);
      } catch (cancelErr) {
        console.error(`[atas/call] nova call criada, mas falha ao cancelar a antiga de ${clientId}:`, cancelErr);
      }
    }

    return Response.json({ call });
  } catch (err) {
    console.error(`[atas/call] falha ao agendar call de ${clientId}:`, err);
    return Response.json({ error: "schedule_failed" }, { status: 502 });
  }
}
