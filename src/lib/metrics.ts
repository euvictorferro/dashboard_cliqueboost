export const DATE_RANGES = [
  { id: "1d", label: "1 dia", days: 1 },
  { id: "7d", label: "1 semana", days: 7 },
  { id: "14d", label: "14 dias", days: 14 },
  { id: "30d", label: "1 mês", days: 30 },
  { id: "60d", label: "60 dias", days: 60 },
  { id: "90d", label: "90 dias", days: 90 },
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
    description: "Quantidade de pessoas que deixaram de seguir o perfil no período selecionado.",
  },
  netFollowers: {
    label: "Seguidores líquidos",
    description: "Resultado final de seguidores: novos seguidores menos seguidores perdidos.",
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

export type TopVideo = {
  id: string;
  title: string;
  views: number;
  thumbnailColor: string;
};

export type OrganicSnapshot = {
  metrics: Record<OrganicMetricKey, number>;
  trend: { date: string; value: number }[];
  topVideos: TopVideo[];
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

export function getOrganicSnapshot(clientId: string, range: DateRangeId): OrganicSnapshot {
  const days = DATE_RANGES.find((r) => r.id === range)!.days;
  const rand = seededRandom(`${clientId}-${range}`);

  const newFollowers = Math.round(20 * days * (0.6 + rand()));
  const lostFollowers = Math.round(6 * days * (0.4 + rand()));
  const reach = Math.round(400 * days * (0.7 + rand()));
  const views = Math.round(reach * (1.4 + rand()));
  const comments = Math.round(views * 0.004 * (0.6 + rand()));
  const likes = Math.round(views * 0.03 * (0.6 + rand()));
  const saves = Math.round(views * 0.01 * (0.6 + rand()));
  const shares = Math.round(views * 0.006 * (0.6 + rand()));

  const trend = Array.from({ length: Math.min(days, 30) }, (_, i) => ({
    date: `D${i + 1}`,
    value: Math.round((reach / Math.min(days, 30)) * (0.6 + rand())),
  }));

  const topVideos: TopVideo[] = Array.from({ length: 5 }, (_, i) => ({
    id: `${clientId}-video-${i + 1}`,
    title: `Vídeo #${i + 1}`,
    views: Math.round((views / 5) * (0.7 + rand())),
    thumbnailColor: ["#7c3aed", "#0080ff", "#00c896", "#ff5c4d", "#8b5cf6"][i],
  })).sort((a, b) => b.views - a.views);

  return {
    metrics: {
      newFollowers,
      lostFollowers,
      netFollowers: newFollowers - lostFollowers,
      reach,
      views,
      comments,
      likes,
      saves,
      shares,
    },
    trend,
    topVideos,
  };
}
