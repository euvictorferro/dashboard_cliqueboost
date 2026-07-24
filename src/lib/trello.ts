// ponytail: server-only — nunca importar isto de um componente "use client" (usa a API Key/Token).
const TRELLO_API = "https://api.trello.com/1";

export function hasTrelloCredentials(): boolean {
  return Boolean(process.env.TRELLO_API_KEY) && Boolean(process.env.TRELLO_TOKEN);
}

async function trelloGet(path: string, params: Record<string, string>) {
  const url = new URL(`${TRELLO_API}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("key", process.env.TRELLO_API_KEY!);
  url.searchParams.set("token", process.env.TRELLO_TOKEN!);
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(typeof json === "string" ? json : JSON.stringify(json));
  return json;
}

export type ContentLabel = { name: string; color: string };

export type ContentCard = {
  id: string;
  name: string;
  description: string;
  labels: ContentLabel[];
  dueDate: number | null;
  assignees: string[];
  attachments: { name: string; url: string }[];
};

export type ContentList = {
  id: string;
  name: string;
  cards: ContentCard[];
};

type RawTrelloList = { id: string; name: string; pos: number };
type RawTrelloLabel = { name: string; color: string | null };
type RawTrelloAttachment = { name: string; url: string; fileName?: string };
type RawTrelloCard = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  idList: string;
  idMembers: string[];
  labels: RawTrelloLabel[];
  attachments: RawTrelloAttachment[];
  pos: number;
};
type RawTrelloMember = { id: string; fullName: string };

// ponytail: paleta de cores nomeadas do Trello (estável há anos, não muda por board) — a API
// devolve o nome da cor ("purple", "green"...), não um hex, então convertemos aqui pro pill
// renderizar com a cor certa. "black" e ausência de cor caem no mesmo cinza neutro.
const TRELLO_LABEL_COLORS: Record<string, string> = {
  green: "#61bd4f",
  yellow: "#f2d600",
  orange: "#ff9f1a",
  red: "#eb5a46",
  purple: "#c377e0",
  blue: "#0079bf",
  sky: "#00c2e0",
  lime: "#51e898",
  pink: "#ff78cb",
  black: "#4d4d4d",
};

function trelloColorToHex(color: string | null): string {
  if (!color) return "#8590a2";
  return TRELLO_LABEL_COLORS[color] ?? "#8590a2";
}

// ponytail: busca ao vivo, sem cache — 3 chamadas em paralelo (lists, cards, members), sem loop
// por card. "attachments=true" é obrigatório pra API devolver os anexos (testado ao vivo).
export async function fetchClientBoard(boardId: string): Promise<ContentList[]> {
  const [rawLists, rawCards, rawMembers]: [RawTrelloList[], RawTrelloCard[], RawTrelloMember[]] = await Promise.all([
    trelloGet(`boards/${boardId}/lists`, { fields: "name,pos" }),
    trelloGet(`boards/${boardId}/cards`, { fields: "name,desc,due,idList,idMembers,labels,pos", attachments: "true" }),
    trelloGet(`boards/${boardId}/members`, { fields: "fullName" }),
  ]);

  const memberNames = new Map(rawMembers.map((m) => [m.id, m.fullName]));

  const cardsByList = new Map<string, ContentCard[]>();
  for (const c of [...rawCards].sort((a, b) => a.pos - b.pos)) {
    const card: ContentCard = {
      id: c.id,
      name: c.name,
      description: c.desc,
      labels: c.labels.map((l) => ({ name: l.name || "Sem nome", color: trelloColorToHex(l.color) })),
      dueDate: c.due ? new Date(c.due).getTime() : null,
      assignees: c.idMembers.map((id) => memberNames.get(id) ?? "Desconhecido"),
      attachments: c.attachments.map((a) => ({ name: a.name || a.fileName || a.url, url: a.url })),
    };
    const existing = cardsByList.get(c.idList) ?? [];
    existing.push(card);
    cardsByList.set(c.idList, existing);
  }

  return [...rawLists]
    .sort((a, b) => a.pos - b.pos)
    .map((l) => ({ id: l.id, name: l.name, cards: cardsByList.get(l.id) ?? [] }));
}
