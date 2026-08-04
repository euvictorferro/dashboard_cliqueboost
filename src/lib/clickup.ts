// src/lib/clickup.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa o token secreto).
const CLICKUP_API = "https://api.clickup.com/api/v2";

export function hasClickUpCredentials(): boolean {
  return Boolean(process.env.CLICKUP_API_TOKEN);
}

export type TaskAssignee = {
  id: string;
  name: string;
  color: string;
  initials: string;
  avatarUrl?: string;
};

export type TaskPriority = {
  label: string;
  color: string;
};

export type TaskCreator = {
  name: string;
  color: string;
  initials: string;
  avatarUrl?: string;
};

// ponytail: "open"/"custom"/"closed" é o campo `type` real do status no ClickUp (confirmado ao
// vivo) — mapeia direto pros 3 ícones de status (não iniciado/em andamento/concluído).
export type StatusType = "open" | "custom" | "closed";

export type TaskItem = {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  statusType: StatusType;
  statusOrder: number;
  dueDate: number | null;
  startDate: number | null;
  assignees: TaskAssignee[];
  description: string;
  priority: TaskPriority | null;
  tags: string[];
  timeEstimate: number | null;
  timeSpent: number;
  dateCreated: number;
  creator: TaskCreator;
};

export type TaskStatus = { status: string; color: string; type: StatusType; orderindex: number };
export type TaskListMember = { id: string; name: string; color: string; initials: string; avatarUrl?: string };

export type TaskComment = {
  id: string;
  text: string;
  date: number;
  authorName: string;
  authorAvatarUrl: string | null;
  authorInitials: string;
  authorColor: string;
};

type RawClickUpAssignee = {
  id: number;
  username: string;
  color: string;
  initials: string;
  profilePicture: string | null;
};

type RawClickUpCreator = {
  username: string;
  color: string;
  profilePicture: string | null;
};

type RawClickUpTask = {
  id: string;
  name: string;
  status: { status: string; color: string; type: string; orderindex: number };
  due_date: string | null;
  start_date: string | null;
  assignees: RawClickUpAssignee[];
  description?: string;
  priority: unknown;
  tags: { name: string }[];
  time_estimate: number | string | null;
  time_spent: number | string | null;
  date_created: string;
  creator: RawClickUpCreator;
};

type RawClickUpStatus = { status: string; color: string; type: string; orderindex: number };
type RawClickUpListMember = {
  id: number;
  username: string;
  color: string;
  initials: string;
  profilePicture: string | null;
};

type RawClickUpComment = {
  id: string;
  comment_text: string;
  date: string;
  user: { username: string; color: string; initials: string; profilePicture: string | null };
};

// ponytail: nenhuma task nos 6 clientes reais tem prioridade definida hoje (confirmado ao vivo
// nesta sessão) — não deu pra testar o formato exato do campo "priority" da API do ClickUp contra
// dado real, e a documentação pública não detalha os sub-campos. Leitura defensiva: tenta os 2
// nomes de campo mais prováveis (`priority` ou `name` pro texto) e cai pra null se não bater.
function parsePriority(raw: unknown): TaskPriority | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const label = typeof p.priority === "string" ? p.priority : typeof p.name === "string" ? p.name : null;
  const color = typeof p.color === "string" ? p.color : null;
  if (!label || !color) return null;
  return { label, color };
}

// ponytail: o ClickUp às vezes devolve a cor de status como variável CSS interna
// ("var(--cu-status-open)") em vez de hex — confirmado ao vivo. Cai num cinza neutro nesse caso,
// mesmo padrão do trelloColorToHex.
function clickupColorToHex(color: string): string {
  return color.startsWith("#") ? color : "#8590a2";
}

// ponytail: qualquer valor de type fora dos 3 conhecidos cai em "custom" (o estado do meio,
// visualmente neutro) em vez de quebrar — defensivo contra listas com status customizados extras.
function parseStatusType(raw: string): StatusType {
  return raw === "open" || raw === "closed" ? raw : "custom";
}

async function clickupGet(path: string) {
  const res = await fetch(`${CLICKUP_API}/${path}`, {
    headers: { Authorization: process.env.CLICKUP_API_TOKEN! },
    cache: "no-store",
  });
  const json = await res.json();
  if (json.err) throw new Error(json.err);
  return json;
}

async function clickupPut(path: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${CLICKUP_API}/${path}`, {
    method: "PUT",
    headers: { Authorization: process.env.CLICKUP_API_TOKEN!, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ponytail: busca ao vivo, sem cache — volume baixo (1 chamada por carregamento da página,
// sem loop de dias como as métricas da Meta) e listas de tarefas mudam bem menos.
export async function fetchClientTasks(listId: string): Promise<TaskItem[]> {
  const url = new URL(`${CLICKUP_API}/list/${listId}/task`);
  url.searchParams.set("include_closed", "true");
  const res = await fetch(url, {
    headers: { Authorization: process.env.CLICKUP_API_TOKEN! },
    cache: "no-store",
  });
  const json = await res.json();
  if (json.err) throw new Error(json.err);

  const tasks: RawClickUpTask[] = json.tasks ?? [];
  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status.status,
    statusColor: clickupColorToHex(t.status.color),
    statusType: parseStatusType(t.status.type),
    statusOrder: t.status.orderindex,
    dueDate: t.due_date ? Number(t.due_date) : null,
    startDate: t.start_date ? Number(t.start_date) : null,
    assignees: t.assignees.map((a) => ({
      id: String(a.id),
      name: a.username,
      color: a.color,
      initials: a.initials,
      avatarUrl: a.profilePicture ?? undefined,
    })),
    description: t.description ?? "",
    priority: parsePriority(t.priority),
    tags: t.tags.map((tag) => tag.name),
    timeEstimate: t.time_estimate ? Number(t.time_estimate) : null,
    timeSpent: t.time_spent ? Number(t.time_spent) : 0,
    dateCreated: Number(t.date_created),
    creator: {
      name: t.creator.username,
      color: t.creator.color,
      initials: t.creator.username.charAt(0).toUpperCase(),
      avatarUrl: t.creator.profilePicture ?? undefined,
    },
  }));
}

// ponytail: 2 chamadas em paralelo (status configurados da lista + membros da lista) — só
// buscado sob demanda quando o dropdown de Status ou Responsáveis é aberto pela primeira vez,
// e agora também na carga inicial da página Tasks (via /api/tasks/[client]) pra montar as seções.
export async function fetchListMeta(listId: string): Promise<{ statuses: TaskStatus[]; members: TaskListMember[] }> {
  const [listJson, membersJson] = await Promise.all([clickupGet(`list/${listId}`), clickupGet(`list/${listId}/member`)]);

  const rawStatuses: RawClickUpStatus[] = listJson.statuses ?? [];
  const rawMembers: RawClickUpListMember[] = membersJson.members ?? [];

  return {
    statuses: [...rawStatuses]
      .sort((a, b) => a.orderindex - b.orderindex)
      .map((s) => ({
        status: s.status,
        color: clickupColorToHex(s.color),
        type: parseStatusType(s.type),
        orderindex: s.orderindex,
      })),
    members: rawMembers.map((m) => ({
      id: String(m.id),
      name: m.username,
      color: m.color,
      initials: m.initials,
      avatarUrl: m.profilePicture ?? undefined,
    })),
  };
}

export async function updateTaskStatus(taskId: string, status: string): Promise<void> {
  await clickupPut(`task/${taskId}`, { status });
}

export async function addTaskAssignee(taskId: string, memberId: string): Promise<void> {
  await clickupPut(`task/${taskId}`, { assignees: { add: [Number(memberId)], rem: [] } });
}

export async function removeTaskAssignee(taskId: string, memberId: string): Promise<void> {
  await clickupPut(`task/${taskId}`, { assignees: { add: [], rem: [Number(memberId)] } });
}

export async function updateTaskDueDate(taskId: string, dueDate: number | null): Promise<void> {
  await clickupPut(`task/${taskId}`, { due_date: dueDate, due_date_time: dueDate !== null });
}

// ponytail: o ClickUp ignora silenciosamente description:"" (trata como "campo não enviado") —
// confirmado ao vivo. Um espaço em branco força a atualização e o ClickUp normaliza pra vazio.
export async function updateTaskDescription(taskId: string, desc: string): Promise<void> {
  await clickupPut(`task/${taskId}`, { description: desc === "" ? " " : desc });
}

export async function fetchTaskComments(taskId: string): Promise<TaskComment[]> {
  const json = await clickupGet(`task/${taskId}/comment`);
  const raw: RawClickUpComment[] = json.comments ?? [];
  return raw.map((c) => ({
    id: c.id,
    text: c.comment_text,
    date: Number(c.date),
    authorName: c.user.username,
    authorAvatarUrl: c.user.profilePicture,
    authorInitials: c.user.initials,
    authorColor: clickupColorToHex(c.user.color),
  }));
}

// ponytail: a resposta do POST de comentário do ClickUp não devolve o usuário de forma
// confiável em todas as versões da API — em vez de tentar parsear um campo que pode não vir,
// a identidade é fixa (é sempre o mesmo token de app, confirmado ao vivo: member "Claude",
// id 296684554, cor #595d66). Só o `id` do comentário criado vem da resposta.
export async function postTaskComment(taskId: string, text: string): Promise<TaskComment> {
  const res = await fetch(`${CLICKUP_API}/task/${taskId}/comment`, {
    method: "POST",
    headers: { Authorization: process.env.CLICKUP_API_TOKEN!, "Content-Type": "application/json" },
    body: JSON.stringify({ comment_text: text }),
  });
  const bodyText = await res.text();
  if (!res.ok) throw new Error(bodyText || "comment failed");
  const json = bodyText ? JSON.parse(bodyText) : {};
  return {
    id: String(json.id ?? Date.now()),
    text,
    date: Date.now(),
    authorName: "Claude",
    authorAvatarUrl: null,
    authorInitials: "C",
    authorColor: "#595d66",
  };
}

export async function createTask(listId: string, title: string, description: string): Promise<void> {
  const res = await fetch(`${CLICKUP_API}/list/${listId}/task`, {
    method: "POST",
    headers: { Authorization: process.env.CLICKUP_API_TOKEN!, "Content-Type": "application/json" },
    body: JSON.stringify({ name: title, description }),
  });
  const json = await res.json();
  if (!res.ok || json.err) throw new Error(json.err ?? `clickup_create_task_failed: ${res.status}`);
}
