// ponytail: server-only — nunca importar isto de um componente "use client" (usa o token secreto).
const CLICKUP_API = "https://api.clickup.com/api/v2";

export function hasClickUpCredentials(): boolean {
  return Boolean(process.env.CLICKUP_API_TOKEN);
}

export type TaskItem = {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  statusOrder: number;
  dueDate: number | null;
  assignees: string[];
  description: string;
};

type RawClickUpTask = {
  id: string;
  name: string;
  status: { status: string; color: string; orderindex: number };
  due_date: string | null;
  assignees: { username: string }[];
  description?: string;
};

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
    assignees: t.assignees.map((a) => a.username),
    description: t.description ?? "",
  }));
}
