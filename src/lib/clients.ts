import { getSupabaseAdmin } from "./supabase";

export type Client = {
  id: string;
  name: string;
  /** Fica true quando o cliente tiver conta de Ads conectada e rodando de fato. */
  adsActive: boolean;
  /** Instagram Business Account ID (Meta Business Suite → Configurações → Contas → Instagram). */
  instagramBusinessId?: string;
  /** Ad Account ID do Meta Ads — só existe pra quem roda tráfego pago. */
  adAccountId?: string;
  /** ID da Lista do ClickUp (Booster Space > Clientes > <nome>) — usada pela página Tasks. */
  clickupListId?: string;
  /** ID do board do Trello do cliente — usado pela página Conteúdos. */
  trelloBoardId?: string;
};

// ponytail: lista hardcoded, como TEAM_MEMBERS no CRM. Migrar pra Supabase quando o projeto novo existir.
export const CLIENTS: Client[] = [
  { id: "debora", name: "Débora Segnini", adsActive: false, instagramBusinessId: "17841460379583584", adAccountId: "2747334925666942", clickupListId: "901714744652", trelloBoardId: "6a45322767a3396275720779" },
  { id: "lais", name: "Laís Daltrozo", adsActive: false, instagramBusinessId: "17841401799523851", adAccountId: "2095558858011678", clickupListId: "901714211778", trelloBoardId: "6a1d9bfebe2405767f61e0d6" },
  { id: "sam", name: "Sam", adsActive: false, instagramBusinessId: "17841403158327784", clickupListId: "901711532887", trelloBoardId: "68dacb7ba8957ca2511e9071" },
  { id: "nelson", name: "Nelson", adsActive: false, instagramBusinessId: "17841433504082304", adAccountId: "959090240381783", clickupListId: "901711532905", trelloBoardId: "6a62cc0c3349ba1222b431e0" },
  { id: "tiago", name: "Tiago Zamboni", adsActive: false, instagramBusinessId: "17841401844913174", clickupListId: "901713981087", trelloBoardId: "6a15e2cce98811c102520e22" },
  { id: "bela", name: "Bela Castro", adsActive: false, instagramBusinessId: "17841445125553950", clickupListId: "901711532881", trelloBoardId: "68f4f4c34ad83399f540858a" },
];

// ponytail: cache de módulo com TTL de 60s — clientes mudam raramente; evita uma query
// por request. Invalidação é o TTL, sem pub/sub.
let cache: { clients: Client[]; at: number } | null = null;
const CACHE_TTL_MS = 60_000;

type ClientRow = {
  id: string; name: string; instagram_business_id: string | null;
  clickup_list_id: string | null; trello_board_id: string | null;
  ad_account_id: string | null; ads_active: boolean;
};

export async function getClients(): Promise<Client[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.clients;
  const supabase = getSupabaseAdmin();
  if (!supabase) return CLIENTS; // fail-safe: sem env, comporta como antes
  const { data, error } = await supabase
    .from("clients").select("*").eq("active", true).order("name");
  if (error || !data || data.length === 0) return CLIENTS; // fail-safe: migration não rodou
  const clients = (data as ClientRow[]).map((r) => ({
    id: r.id, name: r.name,
    instagramBusinessId: r.instagram_business_id ?? undefined,
    clickupListId: r.clickup_list_id ?? undefined,
    trelloBoardId: r.trello_board_id ?? undefined,
    adAccountId: r.ad_account_id ?? undefined,
    adsActive: r.ads_active,
  }));
  cache = { clients, at: Date.now() };
  return clients;
}

export async function getClient(id: string): Promise<Client | null> {
  return (await getClients()).find((c) => c.id === id) ?? null;
}
