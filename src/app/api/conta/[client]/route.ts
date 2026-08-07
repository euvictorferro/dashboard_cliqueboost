// src/app/api/conta/[client]/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchClientSettings, updateClientSettings } from "@/lib/clientSettings";
import { fetchClientPayments } from "@/lib/clientPayments";
import { fetchReferralLeads } from "@/lib/referralLeads";
import { verifyClientSession } from "@/lib/access";
import { US_TIMEZONES } from "@/lib/clientTime";
import { formatContractDuration } from "@/lib/contractDuration";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const [settings, payments, referralLeads] = await Promise.all([
      fetchClientSettings(clientId),
      fetchClientPayments(clientId),
      fetchReferralLeads(clientId),
    ]);
    return Response.json({
      ...settings,
      contractDuration: formatContractDuration(settings.contractStart, new Date()),
      payments,
      referralLeads,
    });
  } catch (err) {
    console.error(`[conta] falha ao buscar configurações de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });

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
