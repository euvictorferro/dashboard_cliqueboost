export const DATE_RANGES = [
  { id: "1d", label: "Hoje", days: 1 },
  { id: "7d", label: "Últimos 7 dias", days: 7 },
  { id: "14d", label: "Últimos 14 dias", days: 14 },
  { id: "30d", label: "Últimos 30 dias", days: 30 },
  { id: "60d", label: "Últimos 60 dias", days: 60 },
  { id: "90d", label: "Últimos 90 dias", days: 90 },
  // ponytail: days:0 nunca é usado de verdade — "custom" sempre é resolvido via since/until
  // explícitos (ver fetchOrganicSnapshotForWindow), nunca por essa contagem de dias.
  { id: "custom", label: "Comparar", days: 0 },
] as const;

export type DateRangeId = (typeof DATE_RANGES)[number]["id"];

export type OrganicMetricKey =
  | "newFollowers"
  | "lostFollowers"
  | "netFollowers"
  | "reach"
  | "views"
  | "comments"
  | "likes"
  | "saves"
  | "shares";

export const ORGANIC_METRICS: Record<
  OrganicMetricKey,
  { label: string; description: string }
> = {
  newFollowers: {
    label: "Novos seguidores",
    description: "Quantidade de pessoas que passaram a seguir o perfil no período selecionado.",
  },
  lostFollowers: {
    label: "Seguidores perdidos",
    description: "Aproximação — o Instagram não informa perdas separadas de ganhos. \"Seguidores líquidos\" é o número confiável.",
  },
  netFollowers: {
    label: "Seguidores líquidos",
    description: "Resultado final de seguidores no período, direto do Instagram — esse número é confiável.",
  },
  reach: {
    label: "Alcance",
    description: "Número de contas únicas que visualizaram algum conteúdo do perfil.",
  },
  views: {
    label: "Views totais",
    description: "Soma de visualizações de todos os conteúdos publicados no período.",
  },
  comments: {
    label: "Comentários",
    description: "Total de comentários recebidos nas publicações do período.",
  },
  likes: {
    label: "Curtidas",
    description: "Total de curtidas recebidas nas publicações do período.",
  },
  saves: {
    label: "Salvamentos",
    description: "Quantas vezes as publicações foram salvas pelos usuários.",
  },
  shares: {
    label: "Compartilhamentos",
    description: "Quantas vezes as publicações foram compartilhadas.",
  },
};

export type TopPost = {
  id: string;
  title: string;
  likes: number;
  thumbnailUrl?: string;
  thumbnailColor: string;
  permalink?: string;
};

export type ReachBreakdown = {
  byFollowType: { follower: number; nonFollower: number; unknown: number };
  byMediaType: { post: number; story: number; reel: number; ad: number };
};

export type OrganicWindowSnapshot = {
  metrics: Record<OrganicMetricKey, number>;
  trend: { date: string; value: number }[];
  viewsTrend: { date: string; value: number }[];
  likesTrend: { date: string; value: number }[];
  topPosts: TopPost[];
  reachBreakdown?: ReachBreakdown;
};

export type OrganicSnapshot = OrganicWindowSnapshot & {
  /** variação % vs. período anterior de mesma duração; null quando não dá pra calcular (base 0) */
  changePct: Record<OrganicMetricKey, number | null>;
};

// ponytail: mock determinístico (seed = clientId+range) até a Meta App existir. Trocar por
// chamada real à Graph API mantendo a mesma forma de retorno (OrganicSnapshot).
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 0xffffffff;
  };
}

function generateMetrics(seed: string, days: number): Record<OrganicMetricKey, number> {
  const rand = seededRandom(seed);
  const newFollowers = Math.round(20 * days * (0.6 + rand()));
  const lostFollowers = Math.round(6 * days * (0.4 + rand()));
  const reach = Math.round(400 * days * (0.7 + rand()));
  const views = Math.round(reach * (1.4 + rand()));
  const comments = Math.round(views * 0.004 * (0.6 + rand()));
  const likes = Math.round(views * 0.03 * (0.6 + rand()));
  const saves = Math.round(views * 0.01 * (0.6 + rand()));
  const shares = Math.round(views * 0.006 * (0.6 + rand()));

  return {
    newFollowers,
    lostFollowers,
    netFollowers: newFollowers - lostFollowers,
    reach,
    views,
    comments,
    likes,
    saves,
    shares,
  };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function getOrganicWindowSnapshot(clientId: string, days: number): OrganicWindowSnapshot {
  const seed = `${clientId}-${days}d`;
  const metrics = generateMetrics(seed, days);
  const rand = seededRandom(`${seed}-trend`);

  const points = Math.min(days, 30);
  const trend = Array.from({ length: points }, (_, i) => ({
    date: `D${i + 1}`,
    value: Math.round((metrics.reach / points) * (0.6 + rand())),
  }));
  const viewsTrend = Array.from({ length: points }, (_, i) => ({
    date: `D${i + 1}`,
    value: Math.round((metrics.views / points) * (0.6 + rand())),
  }));
  const likesTrend = Array.from({ length: points }, (_, i) => ({
    date: `D${i + 1}`,
    value: Math.round((metrics.likes / points) * (0.6 + rand())),
  }));

  const mockTitles = [
    "Vídeo #1",
    "Publicação #2",
    "Reel #3",
    "Publicação #4",
    "Vídeo #5",
  ];
  const topPosts: TopPost[] = Array.from({ length: 5 }, (_, i) => ({
    id: `${clientId}-post-${i + 1}`,
    title: mockTitles[i],
    likes: Math.round((metrics.likes / 5) * (0.7 + rand())),
    thumbnailColor: ["#7c3aed", "#0080ff", "#00c896", "#ff5c4d", "#8b5cf6"][i],
  })).sort((a, b) => b.likes - a.likes);

  const followerShare = 0.55 + rand() * 0.2; // 55–75% do alcance vem de quem já segue
  const reachBreakdown: ReachBreakdown = {
    byFollowType: {
      follower: Math.round(metrics.reach * followerShare),
      nonFollower: Math.round(metrics.reach * (1 - followerShare) * 0.85),
      unknown: Math.round(metrics.reach * (1 - followerShare) * 0.15),
    },
    byMediaType: {
      post: Math.round(metrics.reach * 0.35),
      story: Math.round(metrics.reach * 0.3),
      reel: Math.round(metrics.reach * 0.3),
      ad: Math.round(metrics.reach * 0.05),
    },
  };

  return { metrics, trend, viewsTrend, likesTrend, topPosts, reachBreakdown };
}

export function getOrganicSnapshot(clientId: string, range: DateRangeId): OrganicSnapshot {
  const days = DATE_RANGES.find((r) => r.id === range)!.days;
  const current = getOrganicWindowSnapshot(clientId, days);
  const previous = getOrganicWindowSnapshot(`${clientId}-prev`, days);

  const changePct = Object.fromEntries(
    (Object.keys(current.metrics) as OrganicMetricKey[]).map((key) => [
      key,
      pctChange(current.metrics[key], previous.metrics[key]),
    ])
  ) as Record<OrganicMetricKey, number | null>;

  return { ...current, changePct };
}
