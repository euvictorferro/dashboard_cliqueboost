// src/lib/metaAds.ts
// Insights de tráfego pago via Meta Marketing API (mesmo System User Token do orgânico —
// exige a permissão ads_read e a Ad Account atribuída ao system user no Business Manager).
import type { AdsMetricKey, AdsSnapshot, AdsCreative, AdsTrendPoint } from "./ads";
import { DATE_RANGES, type DateRangeId } from "./metrics";

const GRAPH_API = "https://graph.facebook.com/v21.0";

// Sentinela que a Meta usa quando a conta não tem teto de gasto configurado (cartão de
// crédito ilimitado). Qualquer spend_cap abaixo disso é um teto de verdade.
const NO_SPEND_CAP_THRESHOLD = 1_000_000_000_00; // 1 bilhão em centavos

export function hasMetaCredentials() {
  return Boolean(process.env.META_SYSTEM_USER_TOKEN);
}

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_API}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", process.env.META_SYSTEM_USER_TOKEN!);
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json;
}

// Detecção automática: a aba Ads desbloqueia sozinha quando existe ao menos um anúncio
// com veiculação ativa na conta — sem flag manual no admin.
export async function hasActiveAds(adAccountId: string): Promise<boolean> {
  const json = await graphGet(`act_${adAccountId}/ads`, {
    fields: "id",
    effective_status: '["ACTIVE"]',
    limit: "1",
  });
  return (json.data?.length ?? 0) > 0;
}

function rangeToPreset(range: DateRangeId): string {
  // ponytail: mapeia os presets do dashboard pros date_preset nativos da Graph API.
  const days = DATE_RANGES.find((r) => r.id === range)?.days ?? 30;
  if (days <= 7) return "last_7d";
  if (days <= 14) return "last_14d";
  if (days <= 30) return "last_30d";
  return "last_90d";
}

type InsightsRow = {
  spend?: string;
  clicks?: string;
  cpc?: string;
  cpm?: string;
  impressions?: string;
  reach?: string;
  date_start?: string;
  actions?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
};

// "Resultado" da campanha: a Graph API não expõe o objetivo consolidado por conta, então
// usamos a melhor aproximação disponível: leads > compras > conversas iniciadas > link clicks.
const RESULT_PRIORITY = ["lead", "purchase", "onsite_conversion.messaging_conversation_started_7d", "link_click"];

function pickResult(rows: { action_type: string; value: string }[] | undefined): number {
  if (!rows?.length) return 0;
  for (const type of RESULT_PRIORITY) {
    const hit = rows.find((r) => r.action_type === type);
    if (hit) return Number(hit.value);
  }
  return 0;
}

function toTrend(rows: InsightsRow[], field: "spend" | "clicks"): AdsTrendPoint[] {
  return rows
    .filter((r) => r.date_start)
    .map((r) => ({
      date: r.date_start!.slice(5), // YYYY-MM-DD -> MM-DD (mesmo formato do mock)
      value: Number(r[field] ?? 0),
    }));
}

export type LiveAdsSnapshot = AdsSnapshot & { currency: string };

export async function fetchAdsSnapshotLive(adAccountId: string, range: DateRangeId): Promise<LiveAdsSnapshot> {
  const preset = rangeToPreset(range);
  const insightFields = "spend,clicks,cpc,cpm,impressions,reach,actions,purchase_roas";

  const [account, totals, daily, byAd] = await Promise.all([
    graphGet(`act_${adAccountId}`, { fields: "currency,spend_cap,amount_spent" }),
    graphGet(`act_${adAccountId}/insights`, { fields: insightFields, date_preset: preset }),
    graphGet(`act_${adAccountId}/insights`, { fields: "spend,clicks,date_start", date_preset: preset, time_increment: "1", limit: "100" }),
    graphGet(`act_${adAccountId}/insights`, { fields: "spend,clicks,impressions,actions,ad_name", date_preset: preset, level: "ad", limit: "50" }),
  ]);

  const t: InsightsRow = totals.data?.[0] ?? {};
  const spend = Number(t.spend ?? 0);
  const results = pickResult(t.actions);
  const roasRow = t.purchase_roas?.[0];

  const metrics: Record<AdsMetricKey, number> = {
    spend,
    clicks: Number(t.clicks ?? 0),
    cpc: Number(t.cpc ?? 0),
    cpm: Number(t.cpm ?? 0),
    // CPA e CPR: custo por resultado (mesma aproximação de "resultado" acima).
    cpa: results > 0 ? spend / results : 0,
    cpr: results > 0 ? spend / results : 0,
    roas: roasRow ? Number(roasRow.value) : 0,
    results,
  };

  // spend_cap vem em centavos e só existe de verdade quando a conta tem teto configurado —
  // acima do limiar, é a forma da Meta dizer "sem teto" (cartão ilimitado).
  const spendCapCents = Number(account.spend_cap ?? 0);
  const remainingBudget =
    spendCapCents > 0 && spendCapCents < NO_SPEND_CAP_THRESHOLD
      ? spendCapCents / 100 - Number(account.amount_spent ?? 0) / 100
      : null;

  const dailyRows: InsightsRow[] = daily.data ?? [];
  const adRows: (InsightsRow & { ad_name?: string })[] = byAd.data ?? [];
  const creatives: AdsCreative[] = adRows
    .map((r) => {
      const adSpend = Number(r.spend ?? 0);
      const adResults = pickResult(r.actions);
      const impressions = Number(r.impressions ?? 0);
      return {
        name: r.ad_name ?? "—",
        spend: adSpend,
        results: adResults,
        cpa: adResults > 0 ? adSpend / adResults : 0,
        ctr: impressions > 0 ? (Number(r.clicks ?? 0) / impressions) * 100 : 0,
      };
    })
    .sort((a, b) => b.results - a.results || a.cpa - b.cpa);

  return {
    metrics,
    reach: Number(t.reach ?? 0),
    impressions: Number(t.impressions ?? 0),
    remainingBudget,
    spendTrend: toTrend(dailyRows, "spend"),
    clicksTrend: toTrend(dailyRows, "clicks"),
    // ponytail: ROAS diário exigiria mais uma chamada por dia útil de dado — o sparkline de
    // ROAS reusa o de cliques como proxy visual até alguém pedir ROAS diário de verdade.
    roasTrend: toTrend(dailyRows, "clicks"),
    creatives,
    currency: account.currency ?? "BRL",
  };
}
