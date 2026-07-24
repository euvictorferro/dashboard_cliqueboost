# Modal de Tasks no estilo do Conteúdos (ClickUp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O modal de detalhe de uma Task (`TaskDetailModal.tsx`) fica no mesmo layout 2 colunas do modal de Conteúdos (`ContentCardModal.tsx`), com edição real no ClickUp pros 3 campos que a equipe realmente usa (status, responsáveis, data prevista) mais descrição e comentários — prioridade/tags/tempo continuam só-leitura.

**Architecture:** `src/lib/clickup.ts` ganha funções de leitura de metadados da lista (status configurados + membros) e de escrita campo a campo (status, responsável, data, descrição, comentário), todas via `PUT`/`POST`/`GET` direto em `api.clickup.com/api/v2` com o token do app — mesmo padrão já usado pro Trello em `src/lib/trello.ts`. Rotas novas em `/api/tasks/[client]/...` espelham exatamente o padrão de auth das rotas irmãs de Conteúdos. `clientId`/`accessKey` passam a descer de `TasksPageClient` até `TaskDetailModal` (hoje só chegam em `TasksPageClient`).

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 — sem dependências novas.

## Global Constraints

- Só os campos com uso real hoje ficam editáveis: status, responsáveis, data prevista, descrição, comentários. Prioridade, tags e tempo continuam só-leitura.
- Sem checklist, sem anexos, sem capa de imagem, sem lightbox no modal de Tasks — sem equivalente real no ClickUp usado aqui.
- Sem "atividade" misturada com comentário — só comentários reais do ClickUp.
- `TaskCard.tsx`/`TasksTable.tsx` (visual do board) não mudam de layout — só ganham a plumbing de `clientId`/`accessKey` necessária pra alimentar o modal.
- Cor de status do ClickUp que não é um hex válido (ex.: `"var(--cu-status-open)"`, confirmado ao vivo) cai num cinza neutro (`#8590a2`), mesmo padrão do `trelloColorToHex`.
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, checagens de leitura ao vivo contra a API real do ClickUp, e checagem visual no Browser pane.
- **Task 3 grava dado real no ClickUp de um cliente de verdade.** Toda mudança feita durante a verificação visual deve ser revertida pro valor original ao final do teste (mesmo padrão de "não sujar dado real" já seguido nesta sessão).
- Não mesclar em `main`/`staging` sem aprovação explícita do Victor.

---

### Task 1: Camada de dados — `clickup.ts`

**Files:**
- Modify: `src/lib/clickup.ts` (arquivo inteiro será substituído)

**Interfaces:**
- Produces: `TaskAssignee` ganha `id: string` (campo novo — antes só tinha `name/color/initials/avatarUrl`). `TaskStatus = { status: string; color: string; orderindex: number }`. `TaskListMember = { id: string; name: string; color: string; initials: string; avatarUrl?: string }`. `TaskComment = { id: string; text: string; date: number; authorName: string; authorAvatarUrl: string | null; authorInitials: string; authorColor: string }`. `fetchListMeta(listId: string): Promise<{ statuses: TaskStatus[]; members: TaskListMember[] }>`. `updateTaskStatus(taskId, status): Promise<void>`. `addTaskAssignee(taskId, memberId): Promise<void>`. `removeTaskAssignee(taskId, memberId): Promise<void>`. `updateTaskDueDate(taskId, dueDate: number | null): Promise<void>`. `updateTaskDescription(taskId, desc): Promise<void>`. `fetchTaskComments(taskId): Promise<TaskComment[]>`. `postTaskComment(taskId, text): Promise<TaskComment>`. Todas consumidas pelas rotas da Task 2.

- [ ] **Step 1: Reescrever `src/lib/clickup.ts`**

```ts
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

export type TaskStatus = { status: string; color: string; orderindex: number };
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

type RawClickUpStatus = { status: string; color: string; orderindex: number };
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
  }));
}

// ponytail: 2 chamadas em paralelo (status configurados da lista + membros da lista) — só
// buscado sob demanda quando o dropdown de Status ou Responsáveis é aberto pela primeira vez.
export async function fetchListMeta(listId: string): Promise<{ statuses: TaskStatus[]; members: TaskListMember[] }> {
  const [listJson, membersJson] = await Promise.all([clickupGet(`list/${listId}`), clickupGet(`list/${listId}/member`)]);

  const rawStatuses: RawClickUpStatus[] = listJson.statuses ?? [];
  const rawMembers: RawClickUpListMember[] = membersJson.members ?? [];

  return {
    statuses: [...rawStatuses]
      .sort((a, b) => a.orderindex - b.orderindex)
      .map((s) => ({ status: s.status, color: clickupColorToHex(s.color), orderindex: s.orderindex })),
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

export async function updateTaskDescription(taskId: string, desc: string): Promise<void> {
  await clickupPut(`task/${taskId}`, { description: desc });
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
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Testar a lógica de `fetchListMeta` ao vivo (leitura, sem risco)**

`fetchListMeta` é só uma composição de 2 chamadas HTTP simples — valide a lógica de fallback de cor direto via curl (mais rápido que rodar TypeScript isolado fora do Next.js):

```bash
cd "/Users/victorferro/Projetos/Clique Boost/dashboard_cliqueboost" && source .env.local
curl -s "https://api.clickup.com/api/v2/list/901714744652" -H "Authorization: ${CLICKUP_API_TOKEN}" | python3 -c "
import json,sys
d = json.load(sys.stdin)
for s in d.get('statuses', []):
    print(s['status'], '->', s['color'])
"
```

Expected: lista de status reais da lista da Débora, incluindo pelo menos um com `color` no formato `var(--cu-status-open)` (não `#...`) — confirma que o fallback `clickupColorToHex` em `src/lib/clickup.ts` é necessário e será exercitado.

- [ ] **Step 4: Commit**

```bash
git add src/lib/clickup.ts
git commit -m "clickup.ts: fetchListMeta + escrita de status/responsável/data/descrição/comentário"
```

---

### Task 2: Rotas de API + plumbing de `clientId`/`accessKey`

**Files:**
- Create: `src/app/api/tasks/[client]/list-meta/route.ts`
- Create: `src/app/api/tasks/[client]/task/[taskId]/status/route.ts`
- Create: `src/app/api/tasks/[client]/task/[taskId]/assignees/route.ts`
- Create: `src/app/api/tasks/[client]/task/[taskId]/due-date/route.ts`
- Create: `src/app/api/tasks/[client]/task/[taskId]/description/route.ts`
- Create: `src/app/api/tasks/[client]/task/[taskId]/comments/route.ts`
- Modify: `src/components/TasksPageClient.tsx`
- Modify: `src/components/TasksTable.tsx`

**Interfaces:**
- Consumes: todas as funções de `src/lib/clickup.ts` da Task 1 (`fetchListMeta`, `updateTaskStatus`, `addTaskAssignee`, `removeTaskAssignee`, `updateTaskDueDate`, `updateTaskDescription`, `fetchTaskComments`, `postTaskComment`, `hasClickUpCredentials`).
- Produces: `TasksTable({ tasks, clientId, accessKey }: { tasks: TaskItem[]; clientId: string; accessKey: string })` — mudança de assinatura em relação à versão atual (só recebia `tasks`), consumida pela Task 3 (`TaskDetailModal` vai receber `clientId`/`accessKey` de `TasksTable`).

- [ ] **Step 1: `src/app/api/tasks/[client]/list-meta/route.ts`**

```ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchListMeta, hasClickUpCredentials } from "@/lib/clickup";
import { verifyClientToken } from "@/lib/access";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) {
    return Response.json({ error: "unknown client" }, { status: 404 });
  }
  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!client.clickupListId) {
    return Response.json({ error: "no_list_configured" }, { status: 404 });
  }
  if (!hasClickUpCredentials()) {
    console.error("[tasks] CLICKUP_API_TOKEN não configurado (list-meta)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  try {
    const meta = await fetchListMeta(client.clickupListId);
    return Response.json(meta);
  } catch (err) {
    console.error(`[tasks] falha ao buscar status/membros da lista pra ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: `src/app/api/tasks/[client]/task/[taskId]/status/route.ts`**

```ts
import { NextRequest } from "next/server";
import { hasClickUpCredentials, updateTaskStatus } from "@/lib/clickup";
import { verifyClientToken } from "@/lib/access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; taskId: string }> },
) {
  const { client: clientId, taskId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasClickUpCredentials()) {
    console.error("[tasks] CLICKUP_API_TOKEN não configurado (status)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { status } = await request.json();
  if (typeof status !== "string") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await updateTaskStatus(taskId, status);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[tasks] falha ao trocar status da task ${taskId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 3: `src/app/api/tasks/[client]/task/[taskId]/assignees/route.ts`**

```ts
import { NextRequest } from "next/server";
import { addTaskAssignee, hasClickUpCredentials, removeTaskAssignee } from "@/lib/clickup";
import { verifyClientToken } from "@/lib/access";

async function auth(clientId: string, key: string | undefined) {
  if (!(await verifyClientToken(clientId, key))) return { error: "unauthorized" as const, status: 401 };
  if (!hasClickUpCredentials()) {
    console.error("[tasks] CLICKUP_API_TOKEN não configurado (assignees)");
    return { error: "fetch_failed" as const, status: 502 };
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; taskId: string }> },
) {
  const { client: clientId, taskId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;
  const authError = await auth(clientId, key);
  if (authError) return Response.json({ error: authError.error }, { status: authError.status });

  const { memberId } = await request.json();
  if (typeof memberId !== "string") return Response.json({ error: "invalid_body" }, { status: 400 });

  try {
    await addTaskAssignee(taskId, memberId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[tasks] falha ao adicionar responsável na task ${taskId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; taskId: string }> },
) {
  const { client: clientId, taskId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;
  const authError = await auth(clientId, key);
  if (authError) return Response.json({ error: authError.error }, { status: authError.status });

  const { memberId } = await request.json();
  if (typeof memberId !== "string") return Response.json({ error: "invalid_body" }, { status: 400 });

  try {
    await removeTaskAssignee(taskId, memberId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[tasks] falha ao remover responsável da task ${taskId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 4: `src/app/api/tasks/[client]/task/[taskId]/due-date/route.ts`**

```ts
import { NextRequest } from "next/server";
import { hasClickUpCredentials, updateTaskDueDate } from "@/lib/clickup";
import { verifyClientToken } from "@/lib/access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; taskId: string }> },
) {
  const { client: clientId, taskId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasClickUpCredentials()) {
    console.error("[tasks] CLICKUP_API_TOKEN não configurado (due-date)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { dueDate } = await request.json();
  if (dueDate !== null && typeof dueDate !== "number") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await updateTaskDueDate(taskId, dueDate);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[tasks] falha ao editar data da task ${taskId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 5: `src/app/api/tasks/[client]/task/[taskId]/description/route.ts`**

```ts
import { NextRequest } from "next/server";
import { hasClickUpCredentials, updateTaskDescription } from "@/lib/clickup";
import { verifyClientToken } from "@/lib/access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; taskId: string }> },
) {
  const { client: clientId, taskId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasClickUpCredentials()) {
    console.error("[tasks] CLICKUP_API_TOKEN não configurado (description)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { desc } = await request.json();
  if (typeof desc !== "string") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await updateTaskDescription(taskId, desc);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[tasks] falha ao editar descrição da task ${taskId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 6: `src/app/api/tasks/[client]/task/[taskId]/comments/route.ts`**

```ts
import { NextRequest } from "next/server";
import { fetchTaskComments, hasClickUpCredentials, postTaskComment } from "@/lib/clickup";
import { verifyClientToken } from "@/lib/access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; taskId: string }> },
) {
  const { client: clientId, taskId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasClickUpCredentials()) {
    console.error("[tasks] CLICKUP_API_TOKEN não configurado (comments GET)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  try {
    const comments = await fetchTaskComments(taskId);
    return Response.json({ comments });
  } catch (err) {
    console.error(`[tasks] falha ao buscar comentários da task ${taskId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; taskId: string }> },
) {
  const { client: clientId, taskId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasClickUpCredentials()) {
    console.error("[tasks] CLICKUP_API_TOKEN não configurado (comments POST)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { text } = await request.json();
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const comment = await postTaskComment(taskId, text.trim());
    return Response.json({ comment });
  } catch (err) {
    console.error(`[tasks] falha ao postar comentário na task ${taskId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 7: Plumbing — `TasksPageClient.tsx`**

Trocar a linha:

```tsx
{!error && tasks && <TasksTable tasks={tasks} />}
```

por:

```tsx
{!error && tasks && <TasksTable tasks={tasks} clientId={clientId} accessKey={accessKey} />}
```

- [ ] **Step 8: Plumbing — `TasksTable.tsx`**

Trocar a assinatura da função e a renderização do modal:

```tsx
export function TasksTable({
  tasks,
  clientId,
  accessKey,
}: {
  tasks: TaskItem[];
  clientId: string;
  accessKey: string;
}) {
```

e, no final do JSX:

```tsx
{selectedTask && (
  <TaskDetailModal task={selectedTask} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedTask(null)} />
)}
```

(o resto do arquivo — `TaskSection`, agrupamento por status, etc. — não muda.)

- [ ] **Step 9: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: erro esperado — `TaskDetailModal` ainda não aceita `clientId`/`accessKey` (isso é a Task 3). Confirme que o ÚNICO erro é exatamente esse (propriedade `clientId`/`accessKey` não existe no tipo de props de `TaskDetailModal`) — qualquer outro erro é um problema real desta task, não da Task 3.

- [ ] **Step 10: Testar as rotas de leitura ao vivo (sem risco)**

Com o dev server rodando (`npm run dev`, ou reusar um já ativo):

```bash
curl -s "http://localhost:3000/api/tasks/debora/list-meta?key=e5bff4d1825a067cfab62539526e9a3c" | python3 -m json.tool | head -20
```

Expected: JSON com `statuses` (array de `{status, color, orderindex}`, cores em hex válido — confirma que o fallback de cor funcionou) e `members` (array de `{id, name, color, initials, avatarUrl}`).

```bash
curl -s "http://localhost:3000/api/tasks/debora/task/86e24ghq2/comments?key=e5bff4d1825a067cfab62539526e9a3c" | python3 -m json.tool
```

Expected: `{"comments": []}` ou lista de comentários reais — sem erro 401/502 (`86e24ghq2` é uma task real da Débora, id confirmado ao vivo nesta sessão).

NÃO testar as rotas POST/DELETE (status, assignees, due-date, description, comments POST) nesta task — elas gravam dado real e serão exercitadas com cuidado (com reversão) na checagem visual da Task 3.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/tasks/\[client\]/list-meta src/app/api/tasks/\[client\]/task src/components/TasksPageClient.tsx src/components/TasksTable.tsx
git commit -m "Rotas de API pra status/responsável/data/descrição/comentário de Tasks + plumbing de clientId/accessKey"
```

---

### Task 3: `TaskDetailModal.tsx` — layout 2 colunas + edição real

**Files:**
- Modify: `src/components/TaskDetailModal.tsx` (arquivo inteiro será substituído)

**Interfaces:**
- Consumes: `TaskItem`, `TaskAssignee`, `TaskStatus`, `TaskListMember`, `TaskComment` de `src/lib/clickup.ts` (Task 1). Todas as rotas da Task 2 (`/api/tasks/[client]/list-meta`, `/api/tasks/[client]/task/[taskId]/status`, `/assignees`, `/due-date`, `/description`, `/comments`). `AssigneeAvatars` de `src/components/AssigneeAvatars.tsx` (já existente, sem mudança).
- Produces: `TaskDetailModal({ task, clientId, accessKey, onClose }: { task: TaskItem; clientId: string; accessKey: string; onClose: () => void })` — consumido por `TasksTable.tsx` (Task 2, já ajustado pra passar as props novas).

- [ ] **Step 1: Reescrever `src/components/TaskDetailModal.tsx`**

```tsx
// src/components/TaskDetailModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { TaskComment, TaskItem, TaskListMember, TaskStatus } from "@/lib/clickup";
import { AssigneeAvatars } from "./AssigneeAvatars";

function formatDate(value: number | null): string | null {
  if (value === null) return null;
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function formatTime(timeEstimate: number | null, timeSpent: number): string {
  const parts: string[] = [];
  if (timeEstimate) parts.push(`${formatDuration(timeEstimate)} estimadas`);
  if (timeSpent) parts.push(`${formatDuration(timeSpent)} registradas`);
  return parts.length > 0 ? parts.join(" · ") : "Não definido";
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (diff < minute) return "agora mesmo";
  if (diff < hour) return `há ${Math.floor(diff / minute)} min`;
  if (diff < day) return `há ${Math.floor(diff / hour)} h`;
  if (diff < day * 30) return `há ${Math.floor(diff / day)} d`;
  return new Date(ts).toLocaleDateString("pt-BR");
}

function dateToInputValue(value: number | null): string {
  if (value === null) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Field({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-card-foreground">{label}</p>
        {action}
      </div>
      <div className="text-sm text-card-foreground">{children}</div>
    </div>
  );
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onOutside]);
  return ref;
}

function PlusButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Editar"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-brand-accent hover:text-brand-accent"
    >
      +
    </button>
  );
}

function StatusField({
  status,
  statusColor,
  clientId,
  accessKey,
  taskId,
  onChanged,
}: {
  status: string;
  statusColor: string;
  clientId: string;
  accessKey: string;
  taskId: string;
  onChanged: (status: string, color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<TaskStatus[] | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  useEffect(() => {
    if (!open || statuses !== null) return;
    fetch(`/api/tasks/${clientId}/list-meta?key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      .then((data: { statuses: TaskStatus[] }) => setStatuses(data.statuses ?? []))
      .catch(() => setStatuses([]));
  }, [open, statuses, clientId, accessKey]);

  async function handleSelect(next: TaskStatus) {
    if (next.status === status) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/status?key=${encodeURIComponent(accessKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next.status }),
      });
      if (!res.ok) throw new Error();
      onChanged(next.status, next.color);
    } catch (err) {
      console.error("falha ao trocar status da task", err);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <Field label="Status">
      <div ref={ref} className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={saving}
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: statusColor }}
        >
          {status}
        </button>
        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
            {statuses === null && <p className="px-2 py-1.5 text-xs text-muted-foreground">Carregando...</p>}
            {statuses?.map((s) => (
              <button
                key={s.status}
                type="button"
                onClick={() => handleSelect(s)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="min-w-0 flex-1 truncate">{s.status}</span>
                {s.status === status && <span className="shrink-0 text-brand-accent">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}

function AssigneesField({
  assignees,
  clientId,
  accessKey,
  taskId,
  onToggle,
}: {
  assignees: TaskItem["assignees"];
  clientId: string;
  accessKey: string;
  taskId: string;
  onToggle: (member: TaskListMember, adding: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<TaskListMember[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useClickOutside(() => setOpen(false));

  useEffect(() => {
    if (!open || members !== null) return;
    fetch(`/api/tasks/${clientId}/list-meta?key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      .then((data: { members: TaskListMember[] }) => setMembers(data.members ?? []))
      .catch(() => setMembers([]));
  }, [open, members, clientId, accessKey]);

  async function handleToggle(member: TaskListMember) {
    const isAssigned = assignees.some((a) => a.id === member.id);
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/assignees?key=${encodeURIComponent(accessKey)}`, {
        method: isAssigned ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      if (!res.ok) throw new Error();
      onToggle(member, !isAssigned);
    } catch (err) {
      console.error("falha ao atualizar responsável da task", err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Field
      label="Responsáveis"
      action={
        <div ref={ref} className="relative">
          <PlusButton onClick={() => setOpen((o) => !o)} />
          {open && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
              {members === null && <p className="px-2 py-1.5 text-xs text-muted-foreground">Carregando...</p>}
              {members?.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Sem membros na lista.</p>}
              {members?.map((member) => {
                const isAssigned = assignees.some((a) => a.id === member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleToggle(member)}
                    disabled={busyId === member.id}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${isAssigned ? "bg-muted/70" : ""} disabled:opacity-50`}
                  >
                    {member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL externa do ClickUp
                      <img src={member.avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.initials}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{member.name}</span>
                    {isAssigned && <span className="shrink-0 text-brand-accent">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      }
    >
      {assignees.length === 0 ? (
        <span className="text-muted-foreground">Sem responsável</span>
      ) : (
        <AssigneeAvatars assignees={assignees} size="sm" />
      )}
    </Field>
  );
}

function DueDateField({
  dueDate,
  clientId,
  accessKey,
  taskId,
  onSaved,
}: {
  dueDate: number | null;
  clientId: string;
  accessKey: string;
  taskId: string;
  onSaved: (dueDate: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(dateToInputValue(dueDate));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    const next = draft ? new Date(`${draft}T00:00:00`).getTime() : null;
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/due-date?key=${encodeURIComponent(accessKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: next }),
      });
      if (!res.ok) throw new Error();
      onSaved(next);
      setEditing(false);
    } catch (err) {
      console.error("falha ao editar data da task", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Field
      label="Data prevista"
      action={
        !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(dateToInputValue(dueDate));
              setEditing(true);
            }}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
          >
            Editar
          </button>
        )
      }
    >
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-brand-accent"
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      ) : (
        formatDate(dueDate) ?? <span className="text-muted-foreground">Sem prazo</span>
      )}
    </Field>
  );
}

function DescriptionField({
  text,
  clientId,
  accessKey,
  taskId,
  onSaved,
}: {
  text: string;
  clientId: string;
  accessKey: string;
  taskId: string;
  onSaved: (desc: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/description?key=${encodeURIComponent(accessKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desc: draft }),
      });
      if (!res.ok) throw new Error();
      onSaved(draft);
      setEditing(false);
    } catch (err) {
      console.error("falha ao editar descrição da task", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Field
      label="Descrição"
      action={
        !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(text);
              setEditing(true);
            }}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
          >
            Editar
          </button>
        )
      }
    >
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            autoFocus
            className="w-full resize-y rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : text ? (
        <p className="whitespace-pre-wrap">{text}</p>
      ) : (
        <span className="text-muted-foreground">Sem descrição</span>
      )}
    </Field>
  );
}

function CommentBox({
  clientId,
  accessKey,
  taskId,
  onPosted,
}: {
  clientId: string;
  accessKey: string;
  taskId: string;
  onPosted: (comment: TaskComment) => void;
}) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    if (!text.trim() || posting) return;
    setPosting(true);
    setError(false);
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/comments?key=${encodeURIComponent(accessKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) throw new Error();
      const data: { comment: TaskComment } = await res.json();
      onPosted(data.comment);
      setText("");
    } catch {
      setError(true);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mb-5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escreva um comentário..."
        rows={2}
        className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm text-card-foreground outline-none focus:border-brand-accent"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {error ? <span className="text-xs text-red-600">Falha ao enviar o comentário.</span> : <span />}
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || posting}
          className="shrink-0 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {posting ? "Enviando..." : "Comentar"}
        </button>
      </div>
    </div>
  );
}

function CommentsField({ clientId, accessKey, taskId }: { clientId: string; accessKey: string; taskId: string }) {
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setComments(null);
    setFailed(false);
    fetch(`/api/tasks/${clientId}/task/${taskId}/comments?key=${encodeURIComponent(accessKey)}`)
      .then((res) => {
        if (!res.ok) throw new Error("fetch_failed");
        return res.json();
      })
      .then((data: { comments: TaskComment[] }) => {
        if (!cancelled) setComments(data.comments);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey, taskId]);

  return (
    <div>
      <p className="mb-3 text-sm font-bold text-card-foreground">Comentários</p>

      <CommentBox
        clientId={clientId}
        accessKey={accessKey}
        taskId={taskId}
        onPosted={(comment) => setComments((prev) => (prev ? [comment, ...prev] : [comment]))}
      />

      {failed && <span className="text-sm text-muted-foreground">Não foi possível carregar.</span>}
      {!failed && comments === null && <span className="text-sm text-muted-foreground">Carregando...</span>}
      {!failed && comments !== null && comments.length === 0 && (
        <span className="text-sm text-muted-foreground">Sem comentários.</span>
      )}
      {!failed && comments !== null && comments.length > 0 && (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              {c.authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL externa do ClickUp
                <img src={c.authorAvatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: c.authorColor }}
                >
                  {c.authorInitials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-card-foreground">
                  <span className="font-bold text-card-foreground">{c.authorName}</span> {c.text}
                </p>
                <span className="text-[11px] text-muted-foreground">{formatRelativeTime(c.date)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TaskDetailModal({
  task,
  clientId,
  accessKey,
  onClose,
}: {
  task: TaskItem;
  clientId: string;
  accessKey: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState(task.status);
  const [statusColor, setStatusColor] = useState(task.statusColor);
  const [assignees, setAssignees] = useState(task.assignees);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [description, setDescription] = useState(task.description);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function toggleAssigneeLocal(member: TaskListMember, adding: boolean) {
    setAssignees((prev) =>
      adding
        ? [
            ...prev,
            { id: member.id, name: member.name, color: member.color, initials: member.initials, avatarUrl: member.avatarUrl },
          ]
        : prev.filter((a) => a.id !== member.id),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
          <h2 className="truncate text-sm font-bold text-card-foreground">{task.name}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="p-7">
              <h1 className="mb-6 text-xl font-bold text-card-foreground">{task.name}</h1>

              <div className="space-y-6">
                <div className="flex flex-wrap gap-x-10 gap-y-6">
                  <StatusField
                    status={status}
                    statusColor={statusColor}
                    clientId={clientId}
                    accessKey={accessKey}
                    taskId={task.id}
                    onChanged={(s, c) => {
                      setStatus(s);
                      setStatusColor(c);
                    }}
                  />

                  <AssigneesField
                    assignees={assignees}
                    clientId={clientId}
                    accessKey={accessKey}
                    taskId={task.id}
                    onToggle={toggleAssigneeLocal}
                  />
                </div>

                {task.startDate !== null && <Field label="Início">{formatDate(task.startDate)}</Field>}

                <DueDateField
                  dueDate={dueDate}
                  clientId={clientId}
                  accessKey={accessKey}
                  taskId={task.id}
                  onSaved={setDueDate}
                />

                <Field label="Prioridade">
                  {task.priority ? (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                      style={{ backgroundColor: task.priority.color }}
                    >
                      {task.priority.label}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Sem prioridade</span>
                  )}
                </Field>

                <Field label="Tags">
                  {task.tags.length === 0 ? (
                    <span className="text-muted-foreground">Sem tags</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {task.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-card-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Field>

                <Field label="Tempo">{formatTime(task.timeEstimate, task.timeSpent)}</Field>

                <DescriptionField
                  text={description}
                  clientId={clientId}
                  accessKey={accessKey}
                  taskId={task.id}
                  onSaved={setDescription}
                />
              </div>
            </div>
          </div>

          <div className="min-w-0 shrink-0 overflow-y-auto border-l border-border bg-muted/30 md:w-[380px]">
            <div className="p-6">
              <CommentsField clientId={clientId} accessKey={accessKey} taskId={task.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros (o erro esperado da Task 2/Step 9 desaparece).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 4: Checagem visual no Browser pane — COM REVERSÃO**

Usar a task real `86e24ghq2` ("FUP em trello", lista da Débora, key `e5bff4d1825a067cfab62539526e9a3c`) ou outra task de baixo risco (ex.: uma da Laís, lista `901714211778`, key a confirmar via Supabase se necessário). Abrir `/debora/tasks?key=e5bff4d1825a067cfab62539526e9a3c`, clicar na task, e para CADA campo editável:

1. **Anotar o valor atual antes de mexer.**
2. Editar (trocar status, adicionar um responsável, mudar a data, editar a descrição).
3. Confirmar visualmente que a UI atualizou sem recarregar a página.
4. **Reverter imediatamente pro valor original** usando a mesma UI (trocar o status de volta, remover o responsável que foi adicionado, restaurar a data/descrição original).
5. Confirmar que a reversão também funcionou (UI reflete o valor original de novo).

Comentário: pode postar um comentário de teste (ex.: "teste de verificação — pode ignorar") — comentários no ClickUp não têm uma forma simples de deletar via UI padrão, então usar um texto claramente identificável como teste em vez de tentar reverter.

Confirmar também: painel de Prioridade/Tags/Tempo continuam só-leitura (sem botão de editar); fechar o modal com X/Esc/clique fora; checar `read_console_messages` sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskDetailModal.tsx
git commit -m "TaskDetailModal: layout 2 colunas estilo Conteúdos, edição real de status/responsável/data/descrição/comentário"
```
