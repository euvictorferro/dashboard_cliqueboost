# Tabela de Tasks estilo ClickUp + reorganização do modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A página Tasks vira uma tabela de verdade (seções de status sempre visíveis, ícone por tipo de status, colunas Nome/Status/Data/Responsável/Prioridade) em vez do board de cards estilo Trello; o modal de detalhe reorganiza os campos existentes em pares compactos, com a Descrição vindo logo depois.

**Architecture:** `TaskItem` ganha `statusType` (já vem na resposta do ClickUp, sem chamada nova). A rota `/api/tasks/[client]` passa a devolver `statuses` (lista completa da lista, via `fetchListMeta` já existente) além de `tasks`, pra desenhar seções sempre visíveis mesmo vazias. `TaskCard.tsx` é substituído por `TaskRow.tsx` (linha de tabela em vez de card).

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 — sem dependências novas.

## Global Constraints

- Sem chamada nova de API — `statusType` já vem em `t.status.type` na resposta que `fetchClientTasks` já busca; `statuses` reusa `fetchListMeta`, que já existe (construído numa rodada anterior).
- Seções de status sempre visíveis, mesmo com 0 tasks — usa a lista completa de `statuses`, não deriva mais da lista de tasks presentes.
- Status na linha da tabela é só leitura — clicar na linha inteira abre o modal (edição continua só lá dentro).
- Bandeira de prioridade usa `priority.color`, que já vem direto da API do ClickUp — sem paleta própria.
- `TaskCard.tsx` é removido (sem uso restante depois da Task 3).
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, e checagem visual no Browser pane.
- Não mesclar em `main`/`staging` sem aprovação explícita do Victor.

---

### Task 1: `statusType` em `clickup.ts` + `statuses` na rota

**Files:**
- Modify: `src/lib/clickup.ts` (arquivo inteiro será substituído)
- Modify: `src/app/api/tasks/[client]/route.ts` (arquivo inteiro será substituído)

**Interfaces:**
- Produces: `StatusType = "open" | "custom" | "closed"` (novo, exportado de `src/lib/clickup.ts`). `TaskItem.statusType: StatusType` (campo novo). `TaskStatus` ganha `type: StatusType`. Rota `/api/tasks/[client]` devolve `{ tasks: TaskItem[], statuses: TaskStatus[] }` em vez de só `{ tasks }` — consumido pela Task 3 (`TasksPageClient.tsx`/`TasksTable.tsx`).

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
```

- [ ] **Step 2: Reescrever `src/app/api/tasks/[client]/route.ts`**

```ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { fetchClientTasks, fetchListMeta, hasClickUpCredentials } from "@/lib/clickup";
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
    // ponytail: distinto de "no_list_configured" — isso é config do ambiente (token faltando),
    // não do cliente. Sem essa separação, um token ausente aparentava ser problema de todo cliente.
    console.error("[tasks] CLICKUP_API_TOKEN não configurado");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  try {
    const [tasks, meta] = await Promise.all([fetchClientTasks(client.clickupListId), fetchListMeta(client.clickupListId)]);
    return Response.json({ tasks, statuses: meta.statuses });
  } catch (err) {
    // ponytail: qualquer erro da API do ClickUp cai num 502 — a página trata isso com uma
    // mensagem inline, sem fallback de mock (não existe mock natural pra tarefas).
    console.error(`[tasks] falha ao buscar tasks pra ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: alguns erros esperados em `src/components/TaskCard.tsx`, `src/components/TasksTable.tsx` e `src/components/TasksPageClient.tsx` (ainda não consomem `statusType`/`statuses` — resolvidos na Task 3). Confirme que os únicos erros são nesses 3 arquivos e relacionados a `statusType`/`statuses`; qualquer erro em `src/lib/clickup.ts` ou `src/app/api/tasks/[client]/route.ts` é um problema real deste passo.

- [ ] **Step 4: Testar ao vivo (leitura, sem risco)**

```bash
source .env.local
curl -s "https://api.clickup.com/api/v2/list/901714744652/task?include_closed=true" -H "Authorization: ${CLICKUP_API_TOKEN}" | python3 -c "
import json,sys
d = json.load(sys.stdin)
for t in d['tasks'][:5]:
    print(t['name'], '->', t['status']['type'])
"
```

Expected: cada task mostra um `type` (`open`, `custom` ou `closed`) — confirma que `parseStatusType` no código novo vai receber dado real e mapear certo (nenhuma chamada de escrita, só leitura).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clickup.ts src/app/api/tasks/\[client\]/route.ts
git commit -m "TaskItem ganha statusType + rota de Tasks devolve statuses (sem chamada nova)"
```

---

### Task 2: `StatusIcon.tsx` + `PriorityFlag.tsx`

**Files:**
- Create: `src/components/StatusIcon.tsx`
- Create: `src/components/PriorityFlag.tsx`

**Interfaces:**
- Consumes: `StatusType` e `TaskPriority` de `src/lib/clickup.ts` (Task 1).
- Produces: `StatusIcon({ type, color, size }: { type: StatusType; color: string; size?: number })` e `PriorityFlag({ priority, size }: { priority: TaskPriority | null; size?: number })` — usados por `TaskRow.tsx` na Task 3.

- [ ] **Step 1: Criar `src/components/StatusIcon.tsx`**

```tsx
// src/components/StatusIcon.tsx
import type { StatusType } from "@/lib/clickup";

// ponytail: 3 variantes visuais por type — bolinha tracejada (não iniciado), meia-lua
// preenchida (em andamento), bolinha cheia com check (concluído). Cor vem de fora
// (task.statusColor), já resolvida com o fallback de var(--cu-status-*) em clickup.ts.
export function StatusIcon({ type, color, size = 12 }: { type: StatusType; color: string; size?: number }) {
  if (type === "open") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="6" cy="6" r="5" stroke={color} strokeWidth="1.4" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (type === "closed") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="6" cy="6" r="5" fill={color} />
        <path
          d="M3.5 6.2l1.7 1.7L8.5 4.3"
          stroke="white"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="6" cy="6" r="5" stroke={color} strokeWidth="1.4" />
      <path d="M6 1a5 5 0 0 1 0 10Z" fill={color} />
    </svg>
  );
}
```

- [ ] **Step 2: Criar `src/components/PriorityFlag.tsx`**

```tsx
// src/components/PriorityFlag.tsx
import type { TaskPriority } from "@/lib/clickup";

// ponytail: cor vem direto de priority.color (já é a cor real que o ClickUp devolve pra essa
// prioridade) — sem paleta própria. Sem prioridade -> não renderiza nada (célula vazia na tabela).
export function PriorityFlag({ priority, size = 12 }: { priority: TaskPriority | null; size?: number }) {
  if (!priority) return null;
  return (
    <span title={priority.label}>
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
        <path d="M2.5 1v10" stroke={priority.color} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M2.5 1.5h6.5l-1.8 2.25L9 6H2.5Z" fill={priority.color} />
      </svg>
    </span>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: os mesmos erros da Task 1 (em `TaskCard.tsx`/`TasksTable.tsx`/`TasksPageClient.tsx`, resolvidos na Task 3) — nenhum erro novo em `StatusIcon.tsx`/`PriorityFlag.tsx`. Nenhum dos dois arquivos é importado por ninguém ainda nesta task — isso é esperado.

- [ ] **Step 4: Commit**

```bash
git add src/components/StatusIcon.tsx src/components/PriorityFlag.tsx
git commit -m "Adiciona StatusIcon e PriorityFlag (sem uso ainda)"
```

---

### Task 3: `TaskRow.tsx` + `TasksTable.tsx`/`TasksPageClient.tsx` — tabela de verdade

**Files:**
- Create: `src/components/TaskRow.tsx`
- Delete: `src/components/TaskCard.tsx`
- Modify: `src/components/TasksTable.tsx` (arquivo inteiro será substituído)
- Modify: `src/components/TasksPageClient.tsx` (arquivo inteiro será substituído)

**Interfaces:**
- Consumes: `StatusIcon`/`PriorityFlag` (Task 2), `TaskItem`/`TaskStatus`/`StatusType` de `src/lib/clickup.ts` (Task 1), `getDueDateDisplay` de `src/lib/dateDisplay.ts` (já existe), `AssigneeAvatars` (já existe).
- Produces: `TaskRow({ task, onClick }: { task: TaskItem; onClick: () => void })`. `TasksTable({ tasks, statuses, clientId, accessKey }: { tasks: TaskItem[]; statuses: TaskStatus[]; clientId: string; accessKey: string })` — mudança de assinatura em relação à versão atual (ganha `statuses`).

- [ ] **Step 1: Criar `src/components/TaskRow.tsx`**

```tsx
// src/components/TaskRow.tsx
"use client";

import type { TaskItem } from "@/lib/clickup";
import { getDueDateDisplay } from "@/lib/dateDisplay";
import { AssigneeAvatars } from "./AssigneeAvatars";
import { StatusIcon } from "./StatusIcon";
import { PriorityFlag } from "./PriorityFlag";

export function TaskRow({ task, onClick }: { task: TaskItem; onClick: () => void }) {
  const dueDisplay = task.dueDate !== null ? getDueDateDisplay(task.dueDate) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[1fr_130px_110px_70px_50px] items-center gap-3 border-t border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
    >
      <span className="flex min-w-0 items-center gap-2">
        <StatusIcon type={task.statusType} color={task.statusColor} />
        <span className="truncate text-card-foreground">{task.name}</span>
      </span>
      <span>
        <span
          className="inline-block truncate rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: task.statusColor }}
        >
          {task.status}
        </span>
      </span>
      <span className={`text-xs ${dueDisplay?.className ?? "text-muted-foreground"}`}>{dueDisplay?.text ?? "—"}</span>
      <span>
        <AssigneeAvatars assignees={task.assignees} size="xs" />
      </span>
      <span>
        <PriorityFlag priority={task.priority} />
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Remover `src/components/TaskCard.tsx`**

```bash
git rm src/components/TaskCard.tsx
```

- [ ] **Step 3: Reescrever `src/components/TasksTable.tsx`**

```tsx
// src/components/TasksTable.tsx
"use client";

import { useState } from "react";
import type { TaskItem, TaskStatus } from "@/lib/clickup";
import { TaskRow } from "./TaskRow";
import { TaskDetailModal } from "./TaskDetailModal";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TaskSection({
  status,
  tasks,
  onSelectTask,
}: {
  status: TaskStatus;
  tasks: TaskItem[];
  onSelectTask: (task: TaskItem) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-muted/60">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
        <ChevronIcon open={open} />
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: status.color }}>
          {status.status}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{tasks.length}</span>
      </button>
      {open && (
        <div className="pb-1">
          <div className="grid grid-cols-[1fr_130px_110px_70px_50px] gap-3 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Nome</span>
            <span>Status</span>
            <span>Data</span>
            <span>Responsável</span>
            <span>Prioridade</span>
          </div>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onClick={() => onSelectTask(task)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TasksTable({
  tasks,
  statuses,
  clientId,
  accessKey,
}: {
  tasks: TaskItem[];
  statuses: TaskStatus[];
  clientId: string;
  accessKey: string;
}) {
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const tasksByStatus = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    const existing = tasksByStatus.get(task.status) ?? [];
    existing.push(task);
    tasksByStatus.set(task.status, existing);
  }
  for (const list of tasksByStatus.values()) {
    list.sort((a, b) => {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate - b.dueDate;
    });
  }

  if (statuses.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhum status configurado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {statuses.map((status) => (
        <TaskSection
          key={status.status}
          status={status}
          tasks={tasksByStatus.get(status.status) ?? []}
          onSelectTask={setSelectedTask}
        />
      ))}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Reescrever `src/components/TasksPageClient.tsx`**

```tsx
// src/components/TasksPageClient.tsx
"use client";

import { useEffect, useState } from "react";
import type { TaskItem, TaskStatus } from "@/lib/clickup";
import { TasksTable } from "./TasksTable";

type ErrorKind = "no_list" | "fetch_failed";

export function TasksPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [error, setError] = useState<ErrorKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTasks(null);
    setStatuses([]);
    setError(null);
    fetch(`/api/tasks/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error === "no_list_configured" ? "no_list" : "fetch_failed");
        }
        return data as { tasks: TaskItem[]; statuses: TaskStatus[] };
      })
      .then((data) => {
        if (!cancelled) {
          setTasks(data.tasks);
          setStatuses(data.statuses);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message === "no_list" ? "no_list" : "fetch_failed");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey]);

  const errorMessage =
    error === "no_list"
      ? "Nenhuma lista de tarefas configurada pra esse cliente."
      : "Não foi possível carregar as tarefas agora.";

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Tasks</h1>
      {error && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          {errorMessage}
        </p>
      )}
      {!error && !tasks && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!error && tasks && <TasksTable tasks={tasks} statuses={statuses} clientId={clientId} accessKey={accessKey} />}
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build limpo, `/[client]/tasks` continua na lista de rotas.

- [ ] **Step 7: Checagem visual no Browser pane**

Abrir `/debora/tasks?key=e5bff4d1825a067cfab62539526e9a3c` e confirmar:
- As 3 seções de status aparecem sempre (incluindo "não iniciado" e "em andamento", mesmo que hoje estejam com 0 tasks pra esse cliente).
- Cada linha mostra: ícone de status certo por tipo (bolinha tracejada pra "não iniciado", meia-lua pra "em andamento", bolinha com check pra "concluído") + nome, depois pill de status, data (ou "—" quando vazia), avatar do responsável, bandeira de prioridade (ou vazio quando sem prioridade).
- Clicar numa linha abre o modal normalmente (sem regressão).
- `read_console_messages` sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/components/TaskRow.tsx src/components/TasksTable.tsx src/components/TasksPageClient.tsx
git commit -m "Tabela de Tasks estilo ClickUp (seções sempre visíveis, ícones de status, colunas)"
```

---

### Task 4: Reorganização do `TaskDetailModal.tsx`

**Files:**
- Modify: `src/components/TaskDetailModal.tsx` (arquivo inteiro será substituído)

**Interfaces:**
- Consumes: nada novo — mesmos tipos/rotas já usados hoje (`TaskItem`, `TaskComment`, `TaskListMember`, `TaskStatus`, rotas `/api/tasks/[client]/...` já existentes).
- Produces: mesma assinatura pública `TaskDetailModal({ task, clientId, accessKey, onClose })` — só o JSX interno muda de ordem/agrupamento, nenhuma função ou rota nova.

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
                <div className="grid grid-cols-2 gap-x-10 gap-y-6">
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

                  {task.startDate !== null && <Field label="Início">{formatDate(task.startDate)}</Field>}

                  <Field label="Tempo">{formatTime(task.timeEstimate, task.timeSpent)}</Field>
                </div>

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

Nota: a grade compacta virou `grid grid-cols-2` (2 por linha, sempre) em vez do `flex flex-wrap` anterior — Status+Responsáveis na primeira linha, Data+Prioridade na segunda, Início (quando existe) sozinho, Tempo sozinho. Tags e Descrição ficam fora da grade, largura total, logo abaixo — Descrição é o último campo antes do painel de Comentários (que não muda).

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: zero erros.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpo.

- [ ] **Step 4: Checagem visual no Browser pane**

Abrir `/debora/tasks?key=e5bff4d1825a067cfab62539526e9a3c`, clicar numa task e confirmar: Status e Responsáveis lado a lado na primeira linha, Data prevista e Prioridade lado a lado na segunda, Tempo (e Início, se existir) depois, Tags abaixo disso, Descrição por último — antes do painel de Comentários à direita (sem mudança nele). Confirmar que editar Status/Responsáveis/Data/Descrição continua funcionando (só reposicionado, mesma lógica) — não precisa testar escrita real de novo linha por linha já que nenhuma rota/lógica de dado mudou nesta task, só o JSX de layout; um teste rápido de status ou data já é suficiente pra confirmar que nada quebrou na reorganização.

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskDetailModal.tsx
git commit -m "TaskDetailModal: campos reorganizados em grade 2-por-linha, descrição por último"
```
