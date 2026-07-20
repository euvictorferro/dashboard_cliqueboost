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

export type AdsSnapshot = {
  metrics: Record<AdsMetricKey, number>;
  bestCreative: { name: string; result: string };
};

// ponytail: mock — substituir por chamada à Meta Marketing API quando a Ad Account estiver conectada.
export function getAdsSnapshot(_clientId: string): AdsSnapshot {
  return {
    metrics: { spend: 1200, cpa: 42, cpc: 1.8, cpr: 38, cpm: 24, clicks: 667, roas: 3.4 },
    bestCreative: { name: "Criativo — Depoimento Cliente", result: "3.4x ROAS" },
  };
}

export const WHATSAPP_LINK = "https://wa.me/5500000000000"; // FILL: número real da Clique Boost
