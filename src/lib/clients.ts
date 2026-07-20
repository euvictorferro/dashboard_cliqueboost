export type Client = {
  id: string;
  name: string;
  /** Fica true quando o cliente tiver conta de Ads conectada e rodando de fato. */
  adsActive: boolean;
  /** Instagram Business Account ID (Meta Business Suite → Configurações → Contas → Instagram). */
  instagramBusinessId?: string;
  /** Ad Account ID do Meta Ads — só existe pra quem roda tráfego pago. */
  adAccountId?: string;
};

// ponytail: lista hardcoded, como TEAM_MEMBERS no CRM. Migrar pra Supabase quando o projeto novo existir.
export const CLIENTS: Client[] = [
  { id: "debora", name: "Débora Segnini", adsActive: false, instagramBusinessId: "17841460379583584", adAccountId: "2747334925666942" },
  { id: "lais", name: "Laís Daltrozo", adsActive: false, instagramBusinessId: "17841401799523851", adAccountId: "2095558858011678" },
  { id: "sam", name: "Sam", adsActive: false, instagramBusinessId: "17841403158327784" },
  { id: "nelson", name: "Nelson", adsActive: false, instagramBusinessId: "17841433504082304", adAccountId: "959090240381783" },
  { id: "tiago", name: "Tiago Zamboni", adsActive: false, instagramBusinessId: "17841401844913174" },
  { id: "bela", name: "Bela Castro", adsActive: false, instagramBusinessId: "17841445125553950" },
];
