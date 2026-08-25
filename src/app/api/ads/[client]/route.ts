import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { getAdsSnapshot } from "@/lib/ads";
import { DATE_RANGES, type DateRangeId } from "@/lib/metrics";
import { hasActiveAds, fetchAdsSnapshotLive, hasMetaCredentials } from "@/lib/metaAds";
import { verifyClientSession } from "@/lib/access";
import { DEMO_CLIENT_ID } from "@/lib/demoData";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const range = (request.nextUrl.searchParams.get("range") ?? "30d") as DateRangeId;
  if (range === "custom" || !DATE_RANGES.some((r) => r.id === range)) {
    return Response.json({ error: "invalid range" }, { status: 400 });
  }

  // Conta demo: sempre desbloqueada com o mock (gravação de vídeo/apresentação).
  if (clientId === DEMO_CLIENT_ID) {
    return Response.json({ active: true, ...getAdsSnapshot(clientId), currency: "BRL", source: "mock" });
  }

  if (client.adAccountId && hasMetaCredentials()) {
    try {
      // Desbloqueio automático: existe anúncio com veiculação ativa na Ad Account?
      const active = await hasActiveAds(client.adAccountId);
      if (!active && !client.adsActive) {
        return Response.json({ active: false, source: "live" });
      }
      const snapshot = await fetchAdsSnapshotLive(client.adAccountId, range);
      return Response.json({ active: true, ...snapshot, source: "live" });
    } catch (err) {
      console.error(`[ads] live fetch falhou pra ${clientId}:`, err);
      // Anúncio ligado manualmente no admin (adsActive) mas a Graph API rejeitou a chamada:
      // é problema de token/permissão, não "sem anúncio" — mostra erro explícito, não a
      // tela de venda. Sem a flag manual, mantém o fallback antigo (bloqueado, sem mock fake).
      if (client.adsActive) {
        return Response.json({ active: false, source: "error", errorMessage: err instanceof Error ? err.message : String(err) });
      }
      return Response.json({ active: false, source: "error" });
    }
  }

  // Sem Ad Account cadastrada ou sem credenciais: a flag manual do admin ainda manda
  // (mostra mock — útil só em dev; em produção o caminho live acima é o normal).
  if (client.adsActive) {
    return Response.json({ active: true, ...getAdsSnapshot(clientId), currency: "BRL", source: "mock" });
  }
  return Response.json({ active: false, source: "none" });
}
