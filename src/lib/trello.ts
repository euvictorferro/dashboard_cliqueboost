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

// ponytail: mesmo padrão do trelloGet, mas pra POST/PUT/DELETE — Trello aceita os parâmetros
// como query string em qualquer verbo, não precisa de body.
async function trelloMutate(method: "POST" | "PUT" | "DELETE", path: string, params: Record<string, string>) {
  const url = new URL(`${TRELLO_API}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("key", process.env.TRELLO_API_KEY!);
  url.searchParams.set("token", process.env.TRELLO_TOKEN!);
  const res = await fetch(url, { method });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `trello ${method} ${path} failed`);
  return text ? JSON.parse(text) : null;
}

export type ContentLabel = { id: string; name: string; color: string };
export type ContentAssignee = { id: string; name: string; avatarUrl: string | null; initials: string };
export type ContentChecklistItem = { id: string; name: string; checked: boolean; checklistId: string };
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

export type ContentBoardLabel = { id: string; name: string; color: string };
export type ContentBoardMember = { id: string; name: string; avatarUrl: string | null; initials: string };

export type ContentActivity = {
  id: string;
  date: number;
  authorName: string;
  authorAvatarUrl: string | null;
  authorInitials: string;
  kind: "comment" | "activity";
  text: string;
  textAfter: string | null;
  attachmentRef: { name: string; url: string; previewUrl: string | null } | null;
  isCreation: boolean;
};

export type ContentList = {
  id: string;
  name: string;
  cards: ContentCard[];
};

type RawTrelloList = { id: string; name: string; pos: number };
type RawTrelloLabel = { id: string; name: string; color: string | null };
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
type RawTrelloChecklist = { id: string; checkItems: RawTrelloCheckItem[] };
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
      labels: c.labels.map((l) => ({ id: l.id, name: l.name || "Sem nome", color: trelloColorToHex(l.color) })),
      dueDate: c.due ? new Date(c.due).getTime() : null,
      assignees: c.idMembers.map((id) => {
        const m = membersById.get(id);
        return {
          id,
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
                cl.checkItems.map((item) => ({
                  id: item.id,
                  name: item.name,
                  checked: item.state === "complete",
                  checklistId: cl.id,
                })),
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
      activity.push({
        ...base,
        kind: "comment",
        text: String(action.data.text ?? ""),
        textAfter: null,
        attachmentRef: null,
        isCreation: false,
      });
      continue;
    }
    if (action.type === "addAttachmentToCard") {
      const att = action.data.attachment as { name?: string; url?: string; previewUrl?: string } | undefined;
      activity.push({
        ...base,
        kind: "activity",
        text: "anexou",
        textAfter: "a este card",
        attachmentRef: att?.url ? { name: att.name ?? att.url, url: att.url, previewUrl: att.previewUrl ?? null } : null,
        isCreation: false,
      });
      continue;
    }
    const text = describeAction(action.type, action.data);
    if (text) {
      activity.push({
        ...base,
        kind: "activity",
        text,
        textAfter: null,
        attachmentRef: null,
        isCreation: action.type === "createCard",
      });
    }
  }
  return activity.sort((a, b) => b.date - a.date);
}

export async function setChecklistItemState(cardId: string, checkItemId: string, checked: boolean): Promise<void> {
  await trelloMutate("PUT", `cards/${cardId}/checkItem/${checkItemId}`, { state: checked ? "complete" : "incomplete" });
}

export async function addChecklistItem(checklistId: string, name: string): Promise<ContentChecklistItem> {
  const item = await trelloMutate("POST", `checklists/${checklistId}/checkItems`, { name });
  return { id: item.id, name: item.name, checked: item.state === "complete", checklistId };
}

export async function deleteChecklistItem(checklistId: string, checkItemId: string): Promise<void> {
  await trelloMutate("DELETE", `checklists/${checklistId}/checkItems/${checkItemId}`, {});
}

export async function addComment(cardId: string, text: string): Promise<ContentActivity> {
  const action = await trelloMutate("POST", `cards/${cardId}/actions/comments`, { text });
  const author = action.memberCreator as RawTrelloActionMember | undefined;
  return {
    id: action.id,
    date: new Date(action.date).getTime(),
    authorName: author?.fullName ?? "Você",
    authorAvatarUrl: author?.avatarUrl ? `${author.avatarUrl}/50.png` : null,
    authorInitials: author?.initials ?? "?",
    kind: "comment",
    text: String(action.data?.text ?? text),
    textAfter: null,
    attachmentRef: null,
    isCreation: false,
  };
}

export async function addLinkAttachment(cardId: string, url: string): Promise<ContentAttachment> {
  const attachment = await trelloMutate("POST", `cards/${cardId}/attachments`, { url });
  return {
    name: attachment.name || attachment.url,
    url: attachment.url,
    isUpload: Boolean(attachment.isUpload),
    previewUrl: null,
    largePreviewUrl: null,
    date: new Date(attachment.date).getTime(),
  };
}

// ponytail: upload real (multipart) — diferente das outras mutations, que só mandam parâmetros
// via query string. Node/Next já tem FormData/File nativos, sem precisar de lib extra.
export async function addFileAttachment(cardId: string, file: File): Promise<ContentAttachment> {
  const url = new URL(`${TRELLO_API}/cards/${cardId}/attachments`);
  url.searchParams.set("key", process.env.TRELLO_API_KEY!);
  url.searchParams.set("token", process.env.TRELLO_TOKEN!);
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(url, { method: "POST", body: form });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "upload failed");
  const attachment: RawTrelloAttachment = JSON.parse(text);
  return {
    name: attachment.name || attachment.fileName || attachment.url,
    url: attachment.url,
    isUpload: attachment.isUpload,
    previewUrl: pickSmallestPreviewUrl(attachment),
    largePreviewUrl: pickLargestPreviewUrl(attachment),
    date: new Date(attachment.date).getTime(),
  };
}

export async function updateDescription(cardId: string, desc: string): Promise<void> {
  await trelloMutate("PUT", `cards/${cardId}`, { desc });
}

export async function fetchBoardLabels(boardId: string): Promise<ContentBoardLabel[]> {
  const raw: { id: string; name: string; color: string | null }[] = await trelloGet(`boards/${boardId}/labels`, {
    fields: "name,color",
  });
  return raw.map((l) => ({ id: l.id, name: l.name || "Sem nome", color: trelloColorToHex(l.color) }));
}

export async function fetchBoardMembers(boardId: string): Promise<ContentBoardMember[]> {
  const raw: RawTrelloMember[] = await trelloGet(`boards/${boardId}/members`, { fields: "fullName,avatarUrl,initials" });
  return raw.map((m) => ({
    id: m.id,
    name: m.fullName,
    avatarUrl: m.avatarUrl ? `${m.avatarUrl}/50.png` : null,
    initials: m.initials,
  }));
}

export async function addLabelToCard(cardId: string, labelId: string): Promise<void> {
  await trelloMutate("POST", `cards/${cardId}/idLabels`, { value: labelId });
}

export async function removeLabelFromCard(cardId: string, labelId: string): Promise<void> {
  await trelloMutate("DELETE", `cards/${cardId}/idLabels/${labelId}`, {});
}

export async function addMemberToCard(cardId: string, memberId: string): Promise<void> {
  await trelloMutate("POST", `cards/${cardId}/idMembers`, { value: memberId });
}

export async function removeMemberFromCard(cardId: string, memberId: string): Promise<void> {
  await trelloMutate("DELETE", `cards/${cardId}/idMembers/${memberId}`, {});
}
