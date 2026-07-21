import {
  DATE_RANGES,
  ORGANIC_METRICS,
  type DateRangeId,
  type OrganicMetricKey,
  type OrganicSnapshot,
  type ReachBreakdown,
  type TopPost,
} from "./metrics";
import {
  genderLabel,
  roundToPercentages,
  type AudienceSnapshot,
  type AudienceTimeframeId,
  type DemographicSlice,
} from "./audience";
import { countryName } from "./countries";

// ponytail: server-only — nunca importar isto de um componente "use client" (usa o token secreto).
const GRAPH_API = "https://graph.facebook.com/v21.0";
const MAX_WINDOW_DAYS = 30; // limite real da Graph API pra insights com period=day

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

function chunkWindows(since: number, until: number): [number, number][] {
  const maxSeconds = MAX_WINDOW_DAYS * 86400;
  const windows: [number, number][] = [];
  let start = since;
  while (start < until) {
    const end = Math.min(start + maxSeconds, until);
    windows.push([start, end]);
    start = end;
  }
  return windows;
}

function totalValue(data: { data?: { name: string; total_value?: { value: number } }[] }, name: string): number {
  return data.data?.find((d) => d.name === name)?.total_value?.value ?? 0;
}

type TrendPoint = { date: string; value: number };

const EMPTY_INSIGHTS = { data: [] };

// ponytail: cada métrica tem sua própria janela de retenção na Graph API (ex: follower_count só
// permite os últimos 30 dias a partir de hoje, mais restrito que o limite genérico de 30 dias de
// intervalo). Uma falhar não pode derrubar as outras — cada chamada aqui é isolada.
async function safeGraphGet(path: string, params: Record<string, string>) {
  try {
    return await graphGet(path, params);
  } catch (err) {
    console.error(`[meta] falha em ${path}:`, err instanceof Error ? err.message : err);
    return EMPTY_INSIGHTS;
  }
}

async function fetchChunk(igId: string, since: number, until: number) {
  const [reachRes, followerRes, totalsRes, viewsRes] = await Promise.all([
    safeGraphGet(`${igId}/insights`, { metric: "reach", period: "day", since: String(since), until: String(until) }),
    safeGraphGet(`${igId}/insights`, {
      metric: "follower_count",
      period: "day",
      since: String(since),
      until: String(until),
    }),
    safeGraphGet(`${igId}/insights`, {
      metric: "total_interactions,likes,comments,shares,saves",
      metric_type: "total_value",
      period: "day",
      since: String(since),
      until: String(until),
    }),
    safeGraphGet(`${igId}/insights`, {
      metric: "views",
      metric_type: "total_value",
      period: "day",
      since: String(since),
      until: String(until),
    }),
  ]);

  const reachValues: { value: number; end_time: string }[] = reachRes.data?.[0]?.values ?? [];
  const followerValues: { value: number }[] = followerRes.data?.[0]?.values ?? [];

  let gained = 0;
  let lost = 0;
  for (const v of followerValues) {
    if (v.value > 0) gained += v.value;
    else lost += Math.abs(v.value);
  }

  const trend: TrendPoint[] = reachValues.map((v) => ({
    date: v.end_time.slice(5, 10), // MM-DD
    value: v.value,
  }));

  return {
    newFollowers: gained,
    lostFollowers: lost,
    netFollowers: gained - lost,
    reach: reachValues.reduce((sum, v) => sum + v.value, 0),
    views: totalValue(viewsRes, "views"),
    comments: totalValue(totalsRes, "comments"),
    likes: totalValue(totalsRes, "likes"),
    saves: totalValue(totalsRes, "saves"),
    shares: totalValue(totalsRes, "shares"),
    trend,
  };
}

async function fetchRange(igId: string, since: number, until: number) {
  const chunks = await Promise.all(chunkWindows(since, until).map(([s, u]) => fetchChunk(igId, s, u)));
  return chunks.reduce((acc, chunk) => ({
    newFollowers: acc.newFollowers + chunk.newFollowers,
    lostFollowers: acc.lostFollowers + chunk.lostFollowers,
    netFollowers: acc.netFollowers + chunk.netFollowers,
    reach: acc.reach + chunk.reach,
    views: acc.views + chunk.views,
    comments: acc.comments + chunk.comments,
    likes: acc.likes + chunk.likes,
    saves: acc.saves + chunk.saves,
    shares: acc.shares + chunk.shares,
    trend: [...acc.trend, ...chunk.trend],
  }));
}

function titleFromCaption(caption: string | undefined, fallback: string): string {
  if (!caption) return fallback;
  const firstLine = caption.split("\n")[0].trim();
  return firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine || fallback;
}

async function fetchTopVideos(igId: string, since: number, until: number): Promise<TopPost[]> {
  const mediaRes = await safeGraphGet(`${igId}/media`, {
    fields: "media_type,like_count,thumbnail_url,media_url,caption,permalink",
    since: String(since),
    until: String(until),
    limit: "25",
  });

  const palette = ["#7c3aed", "#0080ff", "#00c896", "#ff5c4d", "#8b5cf6"];
  type Media = {
    id: string;
    media_type: string;
    like_count?: number;
    thumbnail_url?: string;
    media_url?: string;
    caption?: string;
    permalink?: string;
  };

  const posts: Media[] = mediaRes.data ?? [];
  const topByLikes = posts.sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0)).slice(0, 5);

  return topByLikes.map((m, i) => ({
    id: m.id,
    title: titleFromCaption(m.caption, `Publicação #${i + 1}`),
    likes: m.like_count ?? 0,
    thumbnailUrl: m.thumbnail_url ?? m.media_url,
    thumbnailColor: palette[i % palette.length],
    permalink: m.permalink,
  }));
}

type DemographicBreakdownName = "age" | "gender" | "city" | "country";

function labelFor(breakdown: DemographicBreakdownName, rawKey: string): string {
  if (breakdown === "country") return countryName(rawKey);
  if (breakdown === "gender") return genderLabel(rawKey);
  return rawKey; // age e city já vêm como texto legível da Meta
}

async function fetchDemographicBreakdown(
  igId: string,
  metric: "follower_demographics" | "engaged_audience_demographics",
  breakdown: DemographicBreakdownName,
  timeframe: AudienceTimeframeId
): Promise<DemographicSlice[]> {
  // ponytail: o parâmetro é "breakdown" (singular) — igual ao usado por reach/views. Testado
  // direto contra a Graph API real: "breakdowns" (plural, como um exemplo da doc oficial sugeria)
  // retorna erro "(#100) A breakdown parameter must be inputted". Não usar plural aqui.
  const res = await safeGraphGet(`${igId}/insights`, {
    metric,
    period: "lifetime",
    timeframe,
    breakdown,
    metric_type: "total_value",
  });

  const results: { dimension_values: string[]; value: number }[] =
    res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  if (results.length === 0) return [];

  // ponytail: arredondamento "maior resto" (roundToPercentages, de audience.ts) em vez de
  // arredondar cada fatia isoladamente — garante que a soma feche em 100% mesmo antes do corte
  // top-5 de país/cidade (ver Task 1: mesmo problema existia no mock e foi corrigido lá).
  const pcts = roundToPercentages(results.map((r) => r.value));
  const limit = breakdown === "country" || breakdown === "city" ? 5 : results.length;
  return results
    .map((r, i) => {
      const rawKey = r.dimension_values[r.dimension_values.length - 1];
      return { key: rawKey, label: labelFor(breakdown, rawKey), pct: pcts[i] };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit);
}

const DEMOGRAPHIC_BREAKDOWNS = ["age", "gender", "country", "city"] as const;

export async function fetchAudienceSnapshotLive(
  igId: string,
  timeframe: AudienceTimeframeId
): Promise<AudienceSnapshot> {
  await graphGet(igId, { fields: "id" });

  const [followersResults, engagedResults] = await Promise.all([
    Promise.all(DEMOGRAPHIC_BREAKDOWNS.map((b) => fetchDemographicBreakdown(igId, "follower_demographics", b, timeframe))),
    Promise.all(
      DEMOGRAPHIC_BREAKDOWNS.map((b) => fetchDemographicBreakdown(igId, "engaged_audience_demographics", b, timeframe))
    ),
  ]);

  const [followersAge, followersGender, followersCountry, followersCity] = followersResults;
  const [engagedAge, engagedGender, engagedCountry, engagedCity] = engagedResults;

  const hasEnoughData = [...followersResults, ...engagedResults].some((slice) => slice.length > 0);

  return {
    followers: { age: followersAge, gender: followersGender, country: followersCountry, city: followersCity },
    engaged: { age: engagedAge, gender: engagedGender, country: engagedCountry, city: engagedCity },
    hasEnoughData,
  };
}

async function fetchReachBreakdownChunk(
  igId: string,
  since: number,
  until: number,
  breakdown: "follow_type" | "media_product_type"
): Promise<Record<string, number>> {
  const res = await safeGraphGet(`${igId}/insights`, {
    metric: "reach",
    period: "day",
    since: String(since),
    until: String(until),
    metric_type: "total_value",
    breakdown,
  });
  const results: { dimension_values: string[]; value: number }[] =
    res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  const totals: Record<string, number> = {};
  for (const r of results) {
    const key = r.dimension_values[r.dimension_values.length - 1];
    totals[key] = (totals[key] ?? 0) + r.value;
  }
  return totals;
}

export async function fetchReachBreakdown(igId: string, since: number, until: number): Promise<ReachBreakdown> {
  const windows = chunkWindows(since, until);
  const [followTypeChunks, mediaTypeChunks] = await Promise.all([
    Promise.all(windows.map(([s, u]) => fetchReachBreakdownChunk(igId, s, u, "follow_type"))),
    Promise.all(windows.map(([s, u]) => fetchReachBreakdownChunk(igId, s, u, "media_product_type"))),
  ]);

  const sumKey = (chunks: Record<string, number>[], key: string) =>
    chunks.reduce((sum, c) => sum + (c[key] ?? 0), 0);

  return {
    byFollowType: {
      follower: sumKey(followTypeChunks, "FOLLOWER"),
      nonFollower: sumKey(followTypeChunks, "NON_FOLLOWER"),
      unknown: sumKey(followTypeChunks, "UNKNOWN"),
    },
    byMediaType: {
      post: sumKey(mediaTypeChunks, "POST") + sumKey(mediaTypeChunks, "CAROUSEL_CONTAINER"),
      story: sumKey(mediaTypeChunks, "STORY"),
      reel: sumKey(mediaTypeChunks, "REEL") + sumKey(mediaTypeChunks, "REELS"),
      ad: sumKey(mediaTypeChunks, "AD"),
    },
  };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function fetchOrganicSnapshotLive(igId: string, range: DateRangeId): Promise<OrganicSnapshot> {
  // ponytail: checagem de acesso ANTES de tentar puxar métricas — sem isso, uma conta sem
  // permissão nenhuma retorna tudo zerado (cada chamada individual é resiliente e não lançaria
  // erro) em vez de cair pro mock no chamador. Essa chamada crua não é resiliente de propósito.
  await graphGet(igId, { fields: "id" });

  const days = DATE_RANGES.find((r) => r.id === range)!.days;
  const until = Math.floor(Date.now() / 1000);
  const since = until - days * 86400;
  const prevUntil = since;
  const prevSince = since - days * 86400;

  const [current, previous, topPosts, reachBreakdown] = await Promise.all([
    fetchRange(igId, since, until),
    fetchRange(igId, prevSince, prevUntil),
    fetchTopVideos(igId, since, until),
    fetchReachBreakdown(igId, since, until),
  ]);

  const keys = Object.keys(ORGANIC_METRICS) as OrganicMetricKey[];
  const metrics = {} as Record<OrganicMetricKey, number>;
  const changePct = {} as Record<OrganicMetricKey, number | null>;
  for (const key of keys) {
    metrics[key] = current[key];
    changePct[key] = pctChange(current[key], previous[key]);
  }

  return { metrics, changePct, trend: current.trend, topPosts, reachBreakdown };
}
