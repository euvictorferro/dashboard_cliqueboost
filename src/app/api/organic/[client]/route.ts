import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { getOrganicSnapshot, getOrganicWindowSnapshot, DATE_RANGES, type DateRangeId } from "@/lib/metrics";
import { fetchOrganicSnapshotLive, fetchOrganicSnapshotForWindow, hasMetaCredentials } from "@/lib/meta";
import { verifyClientToken } from "@/lib/access";

function parseIsoDate(value: string): number | null {
  const ms = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const sinceParam = request.nextUrl.searchParams.get("since");
  const untilParam = request.nextUrl.searchParams.get("until");
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) {
    return Response.json({ error: "unknown client" }, { status: 404 });
  }

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // ponytail: janela custom (comparativo de datas) tem prioridade sobre "range" quando os dois
  // vierem preenchidos — since/until é sempre explícito, nunca um preset.
  if (sinceParam && untilParam) {
    const since = parseIsoDate(sinceParam);
    const until = parseIsoDate(untilParam);
    if (since === null || until === null || until <= since) {
      return Response.json({ error: "invalid since/until" }, { status: 400 });
    }

    if (client.instagramBusinessId && hasMetaCredentials()) {
      try {
        const snapshot = await fetchOrganicSnapshotForWindow(client.instagramBusinessId, since, until);
        return Response.json({ ...snapshot, source: "live" });
      } catch (err) {
        // ponytail: qualquer erro da Graph API cai pro mock — nunca quebra o dashboard do cliente.
        console.error(`[organic] live fetch (janela custom) falhou pra ${clientId}:`, err);
      }
    }

    const days = Math.round((until - since) / 86400);
    // ponytail: achado do review final — Período A e B sempre têm a mesma duração (CompareRangePicker
    // garante isso), então semear só por "days" faz o mock de A e B saírem idênticos no comparativo.
    // Incluir "since" na semente diferencia as duas janelas sem tocar no seed do modo normal (preset).
    return Response.json({ ...getOrganicWindowSnapshot(`${clientId}-${since}`, days), source: "mock" });
  }

  const range = (request.nextUrl.searchParams.get("range") ?? "30d") as DateRangeId;
  if (range === "custom" || !DATE_RANGES.some((r) => r.id === range)) {
    return Response.json({ error: "invalid range" }, { status: 400 });
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
