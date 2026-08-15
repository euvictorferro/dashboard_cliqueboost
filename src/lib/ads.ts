export type AdsMetricKey = "spend" | "cpa" | "cpc" | "cpr" | "cpm" | "clicks" | "roas";

export const ADS_METRICS: Record<AdsMetricKey, { label: string; description: string }> = {
  spend: { label: "Investimento", description: "Total investido em anúncios no período." },
  cpa: { label: "CPA", description: "Custo por aquisição: quanto custou cada resultado (lead/venda)." },
  cpc: { label: "CPC", description: "Custo por clique no anúncio." },
  cpr: { label: "CPR", description: "Custo por resultado configurado na campanha." },
  cpm: { label: "CPM", description: "Custo a cada mil impressões do anúncio." },
  clicks: { label: "Cliques", description: "Total de cliques recebidos pelos anúncios." },
  roas: { label: "ROAS", description: "Retorno sobre o investimento em anúncios (receita gerada / valor investido)." },
};

export type AdsTrendPoint = { date: string; value: number };

export type AdsSnapshot = {
  metrics: Record<AdsMetricKey, number>;
  spendTrend: AdsTrendPoint[];
  clicksTrend: AdsTrendPoint[];
  roasTrend: AdsTrendPoint[];
  bestCreative: { name: string; result: string };
};

// ponytail: mesmo gerador determinístico do mock orgânico (seed = clientId) — trend visual
// plausível até a Ad Account estar conectada de verdade (Meta Marketing API).
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 0xffffffff;
  };
}

function generateTrend(rand: () => number, days: number, base: number, spread: number): AdsTrendPoint[] {
  const trend: AdsTrendPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    trend.push({
      date: `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      value: Math.round(base * (1 - spread / 2 + rand() * spread)),
    });
  }
  return trend;
}

// ponytail: mock — substituir por chamada à Meta Marketing API quando a Ad Account estiver conectada.
export function getAdsSnapshot(clientId: string): AdsSnapshot {
  const rand = seededRandom(clientId);
  const days = 14;

  const spendTrend = generateTrend(rand, days, 85, 0.7);
  const clicksTrend = generateTrend(rand, days, 48, 0.8);
  const roasTrend = generateTrend(rand, days, 3, 0.6);

  return {
    metrics: { spend: 1200, cpa: 42, cpc: 1.8, cpr: 38, cpm: 24, clicks: 667, roas: 3.4 },
    spendTrend,
    clicksTrend,
    roasTrend,
    bestCreative: { name: "Criativo — Depoimento Cliente", result: "3.4x ROAS" },
  };
}

export const WHATSAPP_LINK = "https://wa.me/12398214737";
