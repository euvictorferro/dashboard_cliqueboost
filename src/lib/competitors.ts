// src/lib/competitors.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export type Competitor = { id: string; handle: string; platform: "instagram" | "tiktok" | "linkedin" };
export type CompetitorPost = {
  id: string;
  thumbnailUrl: string;
  caption: string;
  likes: number;
  reach: number;
  postUrl: string;
};
export type CompetitorProfile = {
  followers: number;
  following: number;
  postsCount: number;
  topPosts: CompetitorPost[];
};

export async function fetchCompetitors(clientId: string): Promise<Competitor[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("content_competitors")
    .select("id, handle, platform")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addCompetitor(
  clientId: string,
  handle: string,
  platform: Competitor["platform"],
): Promise<Competitor> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("content_competitors")
    .insert({ client_id: clientId, handle, platform })
    .select("id, handle, platform")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ponytail: filtra por client_id também no delete — um cliente nunca consegue apagar
// concorrente de outro, mesmo que descubra o id de um competitor alheio.
export async function deleteCompetitor(clientId: string, competitorId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase.from("content_competitors").delete().eq("id", competitorId).eq("client_id", clientId);
  if (error) throw new Error(error.message);
}

// ponytail: hash simples de string -> PRNG mulberry32 (determinístico e estável entre
// recarregamentos) — não é criptográfico, só precisa ser sempre igual pro mesmo handle.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOCK_TOPICS = [
  "bastidores do processo",
  "dica rápida do dia",
  "prova social de cliente",
  "comparativo de bairro",
  "erro comum ao comprar",
  "tour por imóvel",
  "conteúdo educativo",
];

function platformProfileUrl(competitor: Competitor): string {
  const handle = competitor.handle.replace(/^@/, "");
  if (competitor.platform === "tiktok") return `https://www.tiktok.com/@${handle}`;
  if (competitor.platform === "linkedin") return `https://www.linkedin.com/in/${handle}`;
  return `https://www.instagram.com/${handle}`;
}

// ponytail: mock determinístico — mesmo handle sempre gera os mesmos posts/números, pra não
// parecer aleatório a cada recarregamento. Assinatura já pronta pra virar uma chamada real
// (Apify/Firecrawl) depois, sem mudar quem chama esta função.
export async function fetchCompetitorFeed(competitor: Competitor): Promise<CompetitorPost[]> {
  const rand = mulberry32(hashString(competitor.handle));
  const count = 2 + Math.floor(rand() * 4);
  const posts: CompetitorPost[] = [];
  for (let i = 0; i < count; i++) {
    const likes = Math.floor(50 + rand() * 950);
    const reach = Math.floor(likes * (8 + rand() * 12));
    const topic = MOCK_TOPICS[Math.floor(rand() * MOCK_TOPICS.length)];
    posts.push({
      id: `${competitor.id}-post-${i}`,
      thumbnailUrl: "",
      caption: `Post sobre ${topic} (exemplo)`,
      likes,
      reach,
      postUrl: platformProfileUrl(competitor),
    });
  }
  return posts;
}

export async function fetchCompetitorProfile(competitor: Competitor): Promise<CompetitorProfile> {
  const rand = mulberry32(hashString(`${competitor.handle}-profile`));
  const followers = Math.floor(2000 + rand() * 48000);
  const following = Math.floor(100 + rand() * 900);
  const postsCount = Math.floor(50 + rand() * 450);
  const topPosts = await fetchCompetitorFeed(competitor);
  return { followers, following, postsCount, topPosts };
}
