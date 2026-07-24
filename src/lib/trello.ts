// src/lib/trello.ts
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
export type ContentAssignee = { name: string; avatarUrl: string | null; initials: string };
export type ContentChecklistItem = { id: string; name: string; checked: boolean };
export type ContentChecklist = { total: number; checked: number; items: ContentChecklistItem[] };
export type ContentAttachment = {
  name: string;
  url: string;
  isUpload: boolean;
  previewUrl: string | null;
  largePreviewUrl: string | null;
  date: number;
};

export type ContentCard = {
  id: string;
  name: string;
  listName: string;
  description: string;
  labels: ContentLabel[];
  dueDate: number | null;
  assignees: ContentAssignee[];
  attachments: ContentAttachment[];
  coverImageUrl: string | null;
  checklist: ContentChecklist | null;
};

export type ContentActivity = {
  id: string;
  date: number;
  authorName: string;
  authorAvatarUrl: string | null;
  authorInitials: string;
  kind: "comment" | "activity";
  text: string;
  isCreation: boolean;
};

export type ContentList = {
  id: string;
  name: string;
  cards: ContentCard[];
};

type RawTrelloList = { id: string; name: string; pos: number };
type RawTrelloLabel = { name: string; color: string | null };
type RawTrelloPreview = { url: string; width: number; height: number; scaled: boolean };
type RawTrelloAttachment = {
  id: string;
  name: string;
  url: string;
  fileName?: string;
  isUpload: boolean;
  date: string;
  previews: RawTrelloPreview[];
};
type RawTrelloCheckItem = { id: string; name: string; state: string };
type RawTrelloChecklist = { checkItems: RawTrelloCheckItem[] };
type RawTrelloCard = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  idList: string;
  idMembers: string[];
  idAttachmentCover: string | null;
  labels: RawTrelloLabel[];
  attachments: RawTrelloAttachment[];
  checklists: RawTrelloChecklist[];
  pos: number;
  badges: { checkItems: number; checkItemsChecked: number };
};
type RawTrelloMember = { id: string; fullName: string; avatarUrl: string | null; initials: string };
type RawTrelloActionMember = { fullName: string; avatarUrl: string | null; initials: string };
type RawTrelloAction = {
  id: string;
  type: string;
  date: string;
  data: Record<string, unknown>;
  memberCreator: RawTrelloActionMember;
};

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

// ponytail: capa é a maior preview não-escalada do anexo marcado como idAttachmentCover — se
// não houver nenhuma não-escalada, cai pra maior escalada. Sem capa configurada ou anexo/preview
// ausente (removido depois de virar capa) -> null, o card volta pro layout sem capa.
function pickLargestPreviewUrl(attachment: RawTrelloAttachment): string | null {
  if (attachment.previews.length === 0) return null;
  const nonScaled = attachment.previews.filter((p) => !p.scaled);
  const pool = nonScaled.length > 0 ? nonScaled : attachment.previews;
  return [...pool].sort((a, b) => b.width - a.width)[0].url;
}

function pickCoverImageUrl(card: RawTrelloCard): string | null {
  if (!card.idAttachmentCover) return null;
  const attachment = card.attachments.find((a) => a.id === card.idAttachmentCover);
  if (!attachment) return null;
  return pickLargestPreviewUrl(attachment);
}

// ponytail: pra thumbnail pequena na lista de anexos do modal — pega o menor preview disponível
// (não precisa do maior, é só um ícone). null quando o anexo não tem preview (link ou arquivo sem imagem).
function pickSmallestPreviewUrl(attachment: RawTrelloAttachment): string | null {
  if (attachment.previews.length === 0) return null;
  return [...attachment.previews].sort((a, b) => a.width - b.width)[0].url;
}

// ponytail: busca ao vivo, sem cache — 3 chamadas em paralelo (lists, cards, members), sem loop
// por card. "attachments=true" é obrigatório pra API devolver os anexos (testado ao vivo).
export async function fetchClientBoard(boardId: string): Promise<ContentList[]> {
  const [rawLists, rawCards, rawMembers]: [RawTrelloList[], RawTrelloCard[], RawTrelloMember[]] = await Promise.all([
    trelloGet(`boards/${boardId}/lists`, { fields: "name,pos" }),
    trelloGet(`boards/${boardId}/cards`, {
      fields: "name,desc,due,idList,idMembers,labels,pos,idAttachmentCover,badges",
      attachments: "true",
      checklists: "all",
      checkItemStates: "true",
    }),
    trelloGet(`boards/${boardId}/members`, { fields: "fullName,avatarUrl,initials" }),
  ]);

  const membersById = new Map(rawMembers.map((m) => [m.id, m]));
  const listNameById = new Map(rawLists.map((l) => [l.id, l.name]));

  const cardsByList = new Map<string, ContentCard[]>();
  for (const c of [...rawCards].sort((a, b) => a.pos - b.pos)) {
    const card: ContentCard = {
      id: c.id,
      name: c.name,
      listName: listNameById.get(c.idList) ?? "",
      description: c.desc,
      labels: c.labels.map((l) => ({ name: l.name || "Sem nome", color: trelloColorToHex(l.color) })),
      dueDate: c.due ? new Date(c.due).getTime() : null,
      assignees: c.idMembers.map((id) => {
        const m = membersById.get(id);
        return {
          name: m?.fullName ?? "Desconhecido",
          avatarUrl: m?.avatarUrl ? `${m.avatarUrl}/50.png` : null,
          initials: m?.initials ?? "?",
        };
      }),
      attachments: c.attachments.map((a) => ({
        name: a.name || a.fileName || a.url,
        url: a.url,
        isUpload: a.isUpload,
        previewUrl: pickSmallestPreviewUrl(a),
        largePreviewUrl: pickLargestPreviewUrl(a),
        date: new Date(a.date).getTime(),
      })),
      coverImageUrl: pickCoverImageUrl(c),
      checklist:
        c.badges.checkItems > 0
          ? {
              total: c.badges.checkItems,
              checked: c.badges.checkItemsChecked,
              items: c.checklists.flatMap((cl) =>
                cl.checkItems.map((item) => ({ id: item.id, name: item.name, checked: item.state === "complete" })),
              ),
            }
          : null,
    };
    const existing = cardsByList.get(c.idList) ?? [];
    existing.push(card);
    cardsByList.set(c.idList, existing);
  }

  return [...rawLists]
    .sort((a, b) => a.pos - b.pos)
    .map((l) => ({ id: l.id, name: l.name, cards: cardsByList.get(l.id) ?? [] }));
}

// ponytail: cobre os tipos de action mais comuns (mover lista, data, checklist, anexo, membro).
// Tipo não coberto cai fora da lista em vez de mostrar algo genérico feio — upgrade: adicionar
// mais `case`s conforme aparecerem tipos novos no uso real.
function describeAction(type: string, data: Record<string, unknown>): string | null {
  const asObj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);
  const listBefore = asObj(data.listBefore);
  const listAfter = asObj(data.listAfter);
  const card = asObj(data.card);
  const checkItem = asObj(data.checkItem);
  const checklist = asObj(data.checklist);
  const attachment = asObj(data.attachment);
  const member = asObj(data.member);
  const list = asObj(data.list);

  switch (type) {
    case "createCard":
      return `criou este card${list ? ` em "${list.name}"` : ""}`;
    case "updateCard":
      if (listBefore && listAfter) return `moveu de "${listBefore.name}" para "${listAfter.name}"`;
      if (card && "due" in card) return card.due ? "definiu a data prevista" : "removeu a data prevista";
      if (card && "closed" in card) return card.closed ? "arquivou o card" : "reabriu o card";
      return null;
    case "updateCheckItemStateOnCard":
      return `${checkItem?.state === "complete" ? "marcou" : "desmarcou"} "${checkItem?.name}" na checklist`;
    case "addChecklistToCard":
      return `adicionou a checklist "${checklist?.name}"`;
    case "addAttachmentToCard":
      return `anexou "${attachment?.name}"`;
    case "deleteAttachmentFromCard":
      return "removeu um anexo";
    case "addMemberToCard":
      return `adicionou ${member?.fullName ?? "alguém"} ao card`;
    case "removeMemberFromCard":
      return `removeu ${member?.fullName ?? "alguém"} do card`;
    default:
      return null;
  }
}

// ponytail: filter=all + limit=50 em vez de uma allowlist de tipos — mais simples e não perde
// tipo novo silenciosamente. Só é chamada sob demanda (modal aberto), não no fetch do board.
export async function fetchCardActivity(cardId: string): Promise<ContentActivity[]> {
  const rawActions: RawTrelloAction[] = await trelloGet(`cards/${cardId}/actions`, {
    filter: "all",
    limit: "50",
  });

  const activity: ContentActivity[] = [];
  for (const action of rawActions) {
    const author = action.memberCreator;
    const base = {
      id: action.id,
      date: new Date(action.date).getTime(),
      authorName: author?.fullName ?? "Desconhecido",
      authorAvatarUrl: author?.avatarUrl ? `${author.avatarUrl}/50.png` : null,
      authorInitials: author?.initials ?? "?",
    };
    if (action.type === "commentCard") {
      activity.push({ ...base, kind: "comment", text: String(action.data.text ?? ""), isCreation: false });
      continue;
    }
    const text = describeAction(action.type, action.data);
    if (text) activity.push({ ...base, kind: "activity", text, isCreation: action.type === "createCard" });
  }
  return activity.sort((a, b) => b.date - a.date);
}
