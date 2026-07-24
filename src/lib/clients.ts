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
