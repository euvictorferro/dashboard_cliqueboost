// ponytail: server-only — nunca importar isto de um componente "use client" (usa o token secreto).
const CLICKUP_API = "https://api.clickup.com/api/v2";

export function hasClickUpCredentials(): boolean {
  return Boolean(process.env.CLICKUP_API_TOKEN);
}

export type TaskAssignee = {
  name: string;
  color: string;
  initials: string;
  avatarUrl?: string;
};

export type TaskPriority = {
  label: string;
  color: string;
};

export type TaskItem = {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  statusOrder: number;
  dueDate: number | null;
  startDate: number | null;
  assignees: TaskAssignee[];
  description: string;
  priority: TaskPriority | null;
  tags: string[];
  timeEstimate: number | null;
  timeSpent: number;
};

type RawClickUpAssignee = {
  username: string;
  color: string;
  initials: string;
  profilePicture: string | null;
};

type RawClickUpTask = {
  id: string;
  name: string;
  status: { status: string; color: string; orderindex: number };
  due_date: string | null;
  start_date: string | null;
  assignees: RawClickUpAssignee[];
  description?: string;
  priority: unknown;
  tags: { name: string }[];
  time_estimate: number | string | null;
  time_spent: number | string | null;
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
    statusColor: t.status.color,
    statusOrder: t.status.orderindex,
    dueDate: t.due_date ? Number(t.due_date) : null,
    startDate: t.start_date ? Number(t.start_date) : null,
    assignees: t.assignees.map((a) => ({
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
  }));
}
