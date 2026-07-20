export type Client = {
  id: string;
  name: string;
  /** Fica true quando o cliente tiver conta de Ads conectada e rodando de fato. */
  adsActive: boolean;
};

// ponytail: lista hardcoded, como TEAM_MEMBERS no CRM. Migrar pra Supabase quando o projeto novo existir.
export const CLIENTS: Client[] = [
  { id: "debora", name: "Débora Segnini", adsActive: false },
  { id: "lais", name: "Laís Daltrozo", adsActive: false },
  { id: "sam", name: "Sam", adsActive: false },
  { id: "nelson", name: "Nelson", adsActive: false },
  { id: "tiago", name: "Tiago Zamboni", adsActive: false },
  { id: "bela", name: "Bela Castro", adsActive: false },
];
