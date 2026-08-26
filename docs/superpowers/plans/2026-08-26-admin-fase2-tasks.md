# Admin Panel Fase 2 (Tasks nativo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o ClickUp por um kanban de tasks nativo: admin cria/gerencia tasks completas (checklist, prioridade, anexo, tags) por cliente; cliente vê a task, muda status e comenta.

**Architecture:** Tabelas novas no Supabase (`tasks`, `task_statuses`, `task_comments`, `task_checklist_items`, `task_attachments`, `task_tags`, `task_tag_links`), lidas via `getSupabaseAdmin()` (Service Role, sem RLS ativa — mesmo padrão de `lib/clients.ts`/`lib/clientSettings.ts`). Duas famílias de rota de API: `/api/admin/tasks/*` (CRUD completo, `verifyAdminRequest`) e `/api/tasks/[client]/*` (leitura + status + comentário, `verifyClientSession`). UI nova no admin (kanban com modal de edição completo) e reescrita da UI existente do cliente (`TasksPageClient`/`TaskDetailModal`) pra ler das tabelas novas em vez de `lib/clickup.ts`, com edição restrita a status+comentário.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres + Storage), Tailwind CSS v4 — mesmo stack do resto do app, sem dependência nova.

**Spec:** `docs/superpowers/specs/2026-08-25-admin-fase2-tasks-design.md`

## Global Constraints

- Sem importação de dados do ClickUp — todas as tabelas novas nascem vazias.
- Cliente só muda `status` e comenta; toda escrita de outro campo é rejeitada pela API (401/403), não só escondida na UI.
- 2 clientes de teste (`clients.is_test = true`) usados pra validar antes de qualquer cliente real — criados pelo fluxo normal de "criar cliente" do admin (Fase 1), sem código novo além do campo `is_test`.
- Este repositório **não tem framework de teste automatizado** (`package.json` só tem `dev/build/start/lint`, zero arquivos `*.test.*`). Seguindo a convenção existente, cada task é verificada manualmente (`npm run build`, `npm run lint`, `curl` contra as rotas, checagem visual no browser) em vez de suíte de testes — não introduzir Jest/Vitest sem pedido explícito.
- Trabalho acontece na branch `plataforma-v2` (nunca `main`). Commitar a cada task.
- Padrões existentes a seguir: rota de API por domínio em `app/api/<dominio>/`, `getSupabaseAdmin()` pra acesso a dado, `verifyAdminRequest()`/`verifyClientSession()` pra auth, upload direto via `supabase.storage` na própria rota (sem lib intermediária — ver `src/app/api/conta/[client]/logo/route.ts`).

---

### Task 1: Migration — tabelas de tasks + `clients.is_test`

**Files:**
- Create: `supabase/migrations/0028_native_tasks.sql`

**Interfaces:**
- Produces: tabelas `tasks`, `task_statuses`, `task_comments`, `task_checklist_items`, `task_attachments`, `task_tags`, `task_tag_links`; coluna `clients.is_test`. Todas com `agency_id text not null references agencies(id)` exceto as que penduram de `task_id`/`tag_id` (herdam agência via join).

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0028_native_tasks.sql
-- Admin Panel Fase 2 (spec 2026-08-25): kanban de tasks nativo, mata o ClickUp.
alter table clients add column if not exists is_test boolean not null default false;

create table if not exists task_statuses (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null references agencies(id),
  name text not null,
  color text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null references agencies(id),
  client_id text not null references clients(id),
  status_id uuid not null references task_statuses(id),
  title text not null,
  description text not null default '',
  priority text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
  assignee_admin_user_id uuid references admin_users(id),
  due_at timestamptz,
  position integer not null default 0,
  created_by uuid not null references admin_users(id),
  created_at timestamptz not null default now()
);
create index if not exists tasks_client_id_idx on tasks (client_id);
create index if not exists tasks_status_id_idx on tasks (status_id);

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_admin_user_id uuid references admin_users(id),
  author_client_id text references clients(id),
  body text not null,
  created_at timestamptz not null default now(),
  constraint task_comments_single_author check (
    (author_admin_user_id is not null) <> (author_client_id is not null)
  )
);
create index if not exists task_comments_task_id_idx on task_comments (task_id);

create table if not exists task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists task_checklist_items_task_id_idx on task_checklist_items (task_id);

create table if not exists task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  uploaded_by_admin_user_id uuid not null references admin_users(id),
  created_at timestamptz not null default now()
);
create index if not exists task_attachments_task_id_idx on task_attachments (task_id);

create table if not exists task_tags (
  id uuid primary key default gen_random_uuid(),
  agency_id text not null references agencies(id),
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table if not exists task_tag_links (
  task_id uuid not null references tasks(id) on delete cascade,
  tag_id uuid not null references task_tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

alter table task_statuses enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table task_checklist_items enable row level security;
alter table task_attachments enable row level security;
alter table task_tags enable row level security;
alter table task_tag_links enable row level security;
-- ponytail: sem policies ainda (mesma decisão registrada em ARCHITECTURE.md) — todo acesso
-- passa por getSupabaseAdmin() (Service Role, ignora RLS). Policies reais entram junto da
-- virada multi-tenant.

-- Colunas do kanban por padrão (compartilhadas por toda a agência na v1 — customização por
-- cliente fica pra quando houver demanda real).
insert into task_statuses (agency_id, name, color, position)
values
  ('cliqueboost', 'A Fazer', '#94a3b8', 0),
  ('cliqueboost', 'Em Andamento', '#f59e0b', 1),
  ('cliqueboost', 'Concluído', '#22c55e', 2)
on conflict do nothing;
```

- [ ] **Step 2: Rodar a migration**

Não é feita pelo Claude — `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` são "Sensitive" na Vercel e não há acesso local ao banco (ver memória `project_supabase_sensitive_env`). Pedir ao Victor pra colar o SQL no SQL Editor do painel Supabase e confirmar que rodou sem erro antes de seguir pro Task 2.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0028_native_tasks.sql
git commit -m "feat(admin): migration das tabelas de tasks nativas"
```

---

### Task 2: `src/lib/tasks.ts` — camada de dados (admin: CRUD completo)

**Files:**
- Create: `src/lib/tasks.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin` de `@/lib/supabase`
- Produces:
  - `type TaskPriority = "urgent" | "high" | "normal" | "low"`
  - `type NativeTaskStatus = { id: string; name: string; color: string; position: number }`
  - `type NativeTaskTag = { id: string; name: string; color: string }`
  - `type NativeChecklistItem = { id: string; label: string; done: boolean; position: number }`
  - `type NativeTaskComment = { id: string; body: string; createdAt: string; authorType: "admin" | "client"; authorName: string }`
  - `type NativeTask = { id: string; clientId: string; title: string; description: string; priority: TaskPriority; statusId: string; assigneeAdminUserId: string | null; dueAt: string | null; position: number; createdAt: string; tags: NativeTaskTag[]; checklist: NativeChecklistItem[] }`
  - `listStatuses(agencyId: string): Promise<NativeTaskStatus[]>`
  - `listTasksForClient(clientId: string): Promise<NativeTask[]>`
  - `getTask(taskId: string): Promise<NativeTask | null>`
  - `createTask(input: { agencyId: string; clientId: string; statusId: string; title: string; description: string; priority: TaskPriority; assigneeAdminUserId: string | null; dueAt: string | null; createdBy: string }): Promise<NativeTask>`
  - `updateTask(taskId: string, patch: Partial<Pick<NativeTask, "title" | "description" | "priority" | "statusId" | "assigneeAdminUserId" | "dueAt" | "position">>): Promise<void>`
  - `deleteTask(taskId: string): Promise<void>`
  - `updateTaskStatus(taskId: string, statusId: string): Promise<void>` (usado tanto pelo admin quanto pela rota de cliente)
  - `listComments(taskId: string): Promise<NativeTaskComment[]>`
  - `addComment(taskId: string, author: { adminUserId: string; adminUserName: string } | { clientId: string; clientName: string }, body: string): Promise<NativeTaskComment>`
  - `addChecklistItem(taskId: string, label: string): Promise<NativeChecklistItem>`
  - `toggleChecklistItem(itemId: string, done: boolean): Promise<void>`
  - `deleteChecklistItem(itemId: string): Promise<void>`
  - `listTags(agencyId: string): Promise<NativeTaskTag[]>`
  - `createTag(agencyId: string, name: string, color: string): Promise<NativeTaskTag>`
  - `attachTag(taskId: string, tagId: string): Promise<void>`
  - `detachTag(taskId: string, tagId: string): Promise<void>`

- [ ] **Step 1: Escrever o arquivo**

```typescript
// src/lib/tasks.ts
// ponytail: server-only — Service Role Key, nunca importar de "use client".
import { getSupabaseAdmin } from "@/lib/supabase";

export type TaskPriority = "urgent" | "high" | "normal" | "low";

export type NativeTaskStatus = { id: string; name: string; color: string; position: number };
export type NativeTaskTag = { id: string; name: string; color: string };
export type NativeChecklistItem = { id: string; label: string; done: boolean; position: number };
export type NativeTaskComment = {
  id: string;
  body: string;
  createdAt: string;
  authorType: "admin" | "client";
  authorName: string;
};
export type NativeTask = {
  id: string;
  clientId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  statusId: string;
  assigneeAdminUserId: string | null;
  dueAt: string | null;
  position: number;
  createdAt: string;
  tags: NativeTaskTag[];
  checklist: NativeChecklistItem[];
};

function db() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_nao_configurado");
  return supabase;
}

export async function listStatuses(agencyId: string): Promise<NativeTaskStatus[]> {
  const { data, error } = await db()
    .from("task_statuses")
    .select("id, name, color, position")
    .eq("agency_id", agencyId)
    .order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function hydrateTasks(rows: any[]): Promise<NativeTask[]> {
  if (rows.length === 0) return [];
  const taskIds = rows.map((r) => r.id);
  const supabase = db();
  const [{ data: tagLinks }, { data: checklistRows }] = await Promise.all([
    supabase
      .from("task_tag_links")
      .select("task_id, task_tags(id, name, color)")
      .in("task_id", taskIds),
    supabase
      .from("task_checklist_items")
      .select("id, task_id, label, done, position")
      .in("task_id", taskIds)
      .order("position"),
  ]);

  const tagsByTask = new Map<string, NativeTaskTag[]>();
  for (const link of tagLinks ?? []) {
    const tag = (link as any).task_tags;
    if (!tag) continue;
    const list = tagsByTask.get((link as any).task_id) ?? [];
    list.push({ id: tag.id, name: tag.name, color: tag.color });
    tagsByTask.set((link as any).task_id, list);
  }
  const checklistByTask = new Map<string, NativeChecklistItem[]>();
  for (const item of checklistRows ?? []) {
    const list = checklistByTask.get(item.task_id) ?? [];
    list.push({ id: item.id, label: item.label, done: item.done, position: item.position });
    checklistByTask.set(item.task_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    title: r.title,
    description: r.description,
    priority: r.priority,
    statusId: r.status_id,
    assigneeAdminUserId: r.assignee_admin_user_id,
    dueAt: r.due_at,
    position: r.position,
    createdAt: r.created_at,
    tags: tagsByTask.get(r.id) ?? [],
    checklist: checklistByTask.get(r.id) ?? [],
  }));
}

export async function listTasksForClient(clientId: string): Promise<NativeTask[]> {
  const { data, error } = await db()
    .from("tasks")
    .select("*")
    .eq("client_id", clientId)
    .order("position");
  if (error) throw new Error(error.message);
  return hydrateTasks(data ?? []);
}

export async function getTask(taskId: string): Promise<NativeTask | null> {
  const { data, error } = await db().from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [hydrated] = await hydrateTasks([data]);
  return hydrated;
}

export async function createTask(input: {
  agencyId: string;
  clientId: string;
  statusId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeAdminUserId: string | null;
  dueAt: string | null;
  createdBy: string;
}): Promise<NativeTask> {
  const { data, error } = await db()
    .from("tasks")
    .insert({
      agency_id: input.agencyId,
      client_id: input.clientId,
      status_id: input.statusId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      assignee_admin_user_id: input.assigneeAdminUserId,
      due_at: input.dueAt,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "falha_criar_task");
  const [hydrated] = await hydrateTasks([data]);
  return hydrated;
}

export async function updateTask(
  taskId: string,
  patch: Partial<
    Pick<NativeTask, "title" | "description" | "priority" | "statusId" | "assigneeAdminUserId" | "dueAt" | "position">
  >
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.statusId !== undefined) row.status_id = patch.statusId;
  if (patch.assigneeAdminUserId !== undefined) row.assignee_admin_user_id = patch.assigneeAdminUserId;
  if (patch.dueAt !== undefined) row.due_at = patch.dueAt;
  if (patch.position !== undefined) row.position = patch.position;
  const { error } = await db().from("tasks").update(row).eq("id", taskId);
  if (error) throw new Error(error.message);
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await db().from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
}

export async function updateTaskStatus(taskId: string, statusId: string): Promise<void> {
  const { error } = await db().from("tasks").update({ status_id: statusId }).eq("id", taskId);
  if (error) throw new Error(error.message);
}

export async function listComments(taskId: string): Promise<NativeTaskComment[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from("task_comments")
    .select("id, body, created_at, author_admin_user_id, author_client_id, admin_users(name), clients(name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    authorType: r.author_admin_user_id ? "admin" : "client",
    authorName: r.author_admin_user_id ? r.admin_users?.name ?? "Equipe" : r.clients?.name ?? "Cliente",
  }));
}

export async function addComment(
  taskId: string,
  author: { adminUserId: string; adminUserName: string } | { clientId: string; clientName: string },
  body: string
): Promise<NativeTaskComment> {
  const isAdmin = "adminUserId" in author;
  const { data, error } = await db()
    .from("task_comments")
    .insert({
      task_id: taskId,
      author_admin_user_id: isAdmin ? author.adminUserId : null,
      author_client_id: isAdmin ? null : author.clientId,
      body,
    })
    .select("id, body, created_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "falha_comentar");
  return {
    id: data.id,
    body: data.body,
    createdAt: data.created_at,
    authorType: isAdmin ? "admin" : "client",
    authorName: isAdmin ? author.adminUserName : author.clientName,
  };
}

export async function addChecklistItem(taskId: string, label: string): Promise<NativeChecklistItem> {
  const { data: existing } = await db()
    .from("task_checklist_items")
    .select("position")
    .eq("task_id", taskId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = (existing?.[0]?.position ?? -1) + 1;
  const { data, error } = await db()
    .from("task_checklist_items")
    .insert({ task_id: taskId, label, position: nextPosition })
    .select("id, label, done, position")
    .single();
  if (error || !data) throw new Error(error?.message ?? "falha_criar_item");
  return data;
}

export async function toggleChecklistItem(itemId: string, done: boolean): Promise<void> {
  const { error } = await db().from("task_checklist_items").update({ done }).eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function deleteChecklistItem(itemId: string): Promise<void> {
  const { error } = await db().from("task_checklist_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function listTags(agencyId: string): Promise<NativeTaskTag[]> {
  const { data, error } = await db().from("task_tags").select("id, name, color").eq("agency_id", agencyId).order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTag(agencyId: string, name: string, color: string): Promise<NativeTaskTag> {
  const { data, error } = await db()
    .from("task_tags")
    .insert({ agency_id: agencyId, name, color })
    .select("id, name, color")
    .single();
  if (error || !data) throw new Error(error?.message ?? "falha_criar_tag");
  return data;
}

export async function attachTag(taskId: string, tagId: string): Promise<void> {
  const { error } = await db().from("task_tag_links").insert({ task_id: taskId, tag_id: tagId });
  if (error) throw new Error(error.message);
}

export async function detachTag(taskId: string, tagId: string): Promise<void> {
  const { error } = await db().from("task_tag_links").delete().eq("task_id", taskId).eq("tag_id", tagId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `src/lib/tasks.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tasks.ts
git commit -m "feat(admin): camada de dados de tasks nativas (lib/tasks.ts)"
```

---

### Task 3: Rotas de API do admin — CRUD de task

**Files:**
- Create: `src/app/api/admin/tasks/route.ts`
- Create: `src/app/api/admin/tasks/[taskId]/route.ts`
- Create: `src/app/api/admin/task-statuses/route.ts`
- Create: `src/app/api/admin/task-tags/route.ts`

**Interfaces:**
- Consumes: `verifyAdminRequest` de `@/lib/adminSession`; tudo de `@/lib/tasks`
- Produces: `GET/POST /api/admin/tasks` (list por `?client=`, create), `PATCH/DELETE /api/admin/tasks/[taskId]`, `GET /api/admin/task-statuses`, `GET/POST /api/admin/task-tags`

- [ ] **Step 1: `src/app/api/admin/task-statuses/route.ts`**

```typescript
// src/app/api/admin/task-statuses/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { listStatuses } from "@/lib/tasks";

export async function GET() {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const statuses = await listStatuses(admin.agencyId);
  return Response.json({ statuses });
}
```

- [ ] **Step 2: `src/app/api/admin/task-tags/route.ts`**

```typescript
// src/app/api/admin/task-tags/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { listTags, createTag } from "@/lib/tasks";

export async function GET() {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const tags = await listTags(admin.agencyId);
  return Response.json({ tags });
}

export async function POST(request: Request) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const name = body?.name;
  const color = body?.color;
  if (typeof name !== "string" || !name.trim()) return Response.json({ error: "nome_invalido" }, { status: 400 });
  if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return Response.json({ error: "cor_invalida" }, { status: 400 });
  }
  const tag = await createTag(admin.agencyId, name.trim(), color);
  return Response.json({ tag });
}
```

- [ ] **Step 3: `src/app/api/admin/tasks/route.ts`**

```typescript
// src/app/api/admin/tasks/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { createTask, listTasksForClient, type TaskPriority } from "@/lib/tasks";

const PRIORITIES: TaskPriority[] = ["urgent", "high", "normal", "low"];

export async function GET(request: Request) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const clientId = new URL(request.url).searchParams.get("client");
  if (!clientId) return Response.json({ error: "client_obrigatorio" }, { status: 400 });
  const tasks = await listTasksForClient(clientId);
  return Response.json({ tasks });
}

export async function POST(request: Request) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const clientId = body?.clientId;
  const statusId = body?.statusId;
  const title = body?.title;
  const priority = body?.priority ?? "normal";
  if (typeof clientId !== "string" || !clientId) return Response.json({ error: "client_invalido" }, { status: 400 });
  if (typeof statusId !== "string" || !statusId) return Response.json({ error: "status_invalido" }, { status: 400 });
  if (typeof title !== "string" || !title.trim()) return Response.json({ error: "titulo_invalido" }, { status: 400 });
  if (!PRIORITIES.includes(priority)) return Response.json({ error: "prioridade_invalida" }, { status: 400 });

  const task = await createTask({
    agencyId: admin.agencyId,
    clientId,
    statusId,
    title: title.trim(),
    description: typeof body?.description === "string" ? body.description : "",
    priority,
    assigneeAdminUserId: typeof body?.assigneeAdminUserId === "string" ? body.assigneeAdminUserId : null,
    dueAt: typeof body?.dueAt === "string" ? body.dueAt : null,
    createdBy: admin.adminUserId,
  });
  return Response.json({ task });
}
```

- [ ] **Step 4: `src/app/api/admin/tasks/[taskId]/route.ts`**

```typescript
// src/app/api/admin/tasks/[taskId]/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { deleteTask, updateTask, type TaskPriority } from "@/lib/tasks";

const PRIORITIES: TaskPriority[] = ["urgent", "high", "normal", "low"];

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { taskId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "invalid_body" }, { status: 400 });
  if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
    return Response.json({ error: "prioridade_invalida" }, { status: 400 });
  }

  await updateTask(taskId, {
    title: body.title,
    description: body.description,
    priority: body.priority,
    statusId: body.statusId,
    assigneeAdminUserId: body.assigneeAdminUserId,
    dueAt: body.dueAt,
    position: body.position,
  });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { taskId } = await params;
  await deleteTask(taskId);
  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Verificar build**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/tasks src/app/api/admin/task-statuses src/app/api/admin/task-tags
git commit -m "feat(admin): rotas de API para CRUD de tasks"
```

---

### Task 4: Rotas de API do admin — checklist, tags-na-task, anexos

**Files:**
- Create: `src/app/api/admin/tasks/[taskId]/checklist/route.ts`
- Create: `src/app/api/admin/tasks/[taskId]/checklist/[itemId]/route.ts`
- Create: `src/app/api/admin/tasks/[taskId]/tags/route.ts`
- Create: `src/app/api/admin/tasks/[taskId]/attachments/route.ts`
- Create: `src/app/api/admin/tasks/[taskId]/attachments/[attachmentId]/route.ts`

**Interfaces:**
- Consumes: `verifyAdminRequest`, `addChecklistItem`/`toggleChecklistItem`/`deleteChecklistItem`/`attachTag`/`detachTag` de `@/lib/tasks`, `getSupabaseAdmin` de `@/lib/supabase`
- Produces: `POST /api/admin/tasks/[taskId]/checklist`, `PATCH|DELETE /api/admin/tasks/[taskId]/checklist/[itemId]`, `POST|DELETE /api/admin/tasks/[taskId]/tags`, `GET|POST /api/admin/tasks/[taskId]/attachments`, `DELETE /api/admin/tasks/[taskId]/attachments/[attachmentId]`

- [ ] **Step 1: `checklist/route.ts`**

```typescript
// src/app/api/admin/tasks/[taskId]/checklist/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { addChecklistItem } from "@/lib/tasks";

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { taskId } = await params;
  const body = await request.json().catch(() => null);
  const label = body?.label;
  if (typeof label !== "string" || !label.trim()) return Response.json({ error: "label_invalido" }, { status: 400 });
  const item = await addChecklistItem(taskId, label.trim());
  return Response.json({ item });
}
```

- [ ] **Step 2: `checklist/[itemId]/route.ts`**

```typescript
// src/app/api/admin/tasks/[taskId]/checklist/[itemId]/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { toggleChecklistItem, deleteChecklistItem } from "@/lib/tasks";

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { itemId } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.done !== "boolean") return Response.json({ error: "done_invalido" }, { status: 400 });
  await toggleChecklistItem(itemId, body.done);
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { itemId } = await params;
  await deleteChecklistItem(itemId);
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: `tags/route.ts`**

```typescript
// src/app/api/admin/tasks/[taskId]/tags/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { attachTag, detachTag } from "@/lib/tasks";

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { taskId } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.tagId !== "string") return Response.json({ error: "tag_invalida" }, { status: 400 });
  await attachTag(taskId, body.tagId);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { taskId } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.tagId !== "string") return Response.json({ error: "tag_invalida" }, { status: 400 });
  await detachTag(taskId, body.tagId);
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: `attachments/route.ts`** (upload direto no bucket, mesmo padrão de `conta/[client]/logo`)

```typescript
// src/app/api/admin/tasks/[taskId]/attachments/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabase";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export async function GET(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { taskId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });
  const { data, error } = await supabase
    .from("task_attachments")
    .select("id, storage_path, filename, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: "fetch_failed" }, { status: 502 });
  const attachments = (data ?? []).map((a) => ({
    id: a.id,
    filename: a.filename,
    createdAt: a.created_at,
    url: supabase.storage.from("task-attachments").getPublicUrl(a.storage_path).data.publicUrl,
  }));
  return Response.json({ attachments });
}

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { taskId } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "invalid_body" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return Response.json({ error: "too_large" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });

  const path = `${taskId}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("task-attachments")
    .upload(path, buffer, { contentType: file.type || "application/octet-stream" });
  if (uploadError) return Response.json({ error: "upload_failed", detail: uploadError.message }, { status: 502 });

  const { data, error } = await supabase
    .from("task_attachments")
    .insert({ task_id: taskId, storage_path: path, filename: file.name, uploaded_by_admin_user_id: admin.adminUserId })
    .select("id, storage_path, filename, created_at")
    .single();
  if (error || !data) return Response.json({ error: "falha_registrar_anexo" }, { status: 502 });

  return Response.json({
    attachment: {
      id: data.id,
      filename: data.filename,
      createdAt: data.created_at,
      url: supabase.storage.from("task-attachments").getPublicUrl(data.storage_path).data.publicUrl,
    },
  });
}
```

- [ ] **Step 5: `attachments/[attachmentId]/route.ts`**

```typescript
// src/app/api/admin/tasks/[taskId]/attachments/[attachmentId]/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function DELETE(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { attachmentId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });

  const { data: attachment } = await supabase
    .from("task_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (attachment) await supabase.storage.from("task-attachments").remove([attachment.storage_path]);
  await supabase.from("task_attachments").delete().eq("id", attachmentId);
  return Response.json({ ok: true });
}
```

- [ ] **Step 6: Verificar build**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/tasks
git commit -m "feat(admin): rotas de checklist, tags e anexos de task"
```

**Pré-requisito manual (Victor):** criar o bucket `task-attachments` no Supabase Storage (painel, mesmo processo do bucket `client-logos` já existente) antes de testar upload.

---

### Task 5: Admin UI — página Tasks (kanban) e sidebar

**Files:**
- Create: `src/app/admin/(authed)/tasks/page.tsx`
- Create: `src/components/admin/tasks/TasksAdminPageClient.tsx`
- Create: `src/components/admin/tasks/TaskKanbanColumn.tsx`
- Create: `src/components/admin/tasks/TaskCard.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `NativeTask`, `NativeTaskStatus` types (duplicar shape mínimo no client component via fetch — client components não importam `@/lib/tasks` diretamente porque é server-only; definir os tipos localmente no componente, mesma convenção do `TaskItem` em `@/lib/clickup` sendo importado só por componentes que já eram server-adjacent — aqui usamos um tipo local `AdminTask`)
- Produces: `AdminTask` (shape idêntico ao JSON de `GET /api/admin/tasks?client=`), componente `TasksAdminPageClient({ })` que lista clientes (via `GET /api/admin/clients` já existente), deixa escolher um, mostra kanban

- [ ] **Step 1: `src/app/admin/(authed)/tasks/page.tsx`**

```typescript
import { TasksAdminPageClient } from "@/components/admin/tasks/TasksAdminPageClient";

export default function AdminTasksPage() {
  return <TasksAdminPageClient />;
}
```

- [ ] **Step 2: `src/components/admin/tasks/TaskCard.tsx`**

```typescript
"use client";

type Priority = "urgent" | "high" | "normal" | "low";

const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgente",
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};
const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "#ef4444",
  high: "#f59e0b",
  normal: "#94a3b8",
  low: "#64748b",
};

export type AdminTask = {
  id: string;
  title: string;
  priority: Priority;
  statusId: string;
  dueAt: string | null;
  tags: { id: string; name: string; color: string }[];
  checklist: { id: string; done: boolean }[];
};

export function TaskCard({ task, onOpen }: { task: AdminTask; onOpen: () => void }) {
  const doneCount = task.checklist.filter((c) => c.done).length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-md border border-border bg-card p-3 text-left shadow-sm hover:border-brand-accent"
    >
      <p className="text-sm font-semibold text-card-foreground">{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: PRIORITY_COLOR[task.priority] }}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.tags.map((t) => (
          <span key={t.id} className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: t.color }}>
            {t.name}
          </span>
        ))}
        {task.checklist.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {doneCount}/{task.checklist.length}
          </span>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 3: `src/components/admin/tasks/TaskKanbanColumn.tsx`**

```typescript
"use client";

import { TaskCard, type AdminTask } from "@/components/admin/tasks/TaskCard";

export function TaskKanbanColumn({
  name,
  color,
  tasks,
  onOpenTask,
}: {
  name: string;
  color: string;
  tasks: AdminTask[];
  onOpenTask: (task: AdminTask) => void;
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-md bg-muted/30 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-sm font-bold text-card-foreground">{name}</p>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={() => onOpenTask(t)} />
        ))}
        {tasks.length === 0 && <p className="text-xs text-muted-foreground">Sem tasks</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `src/components/admin/tasks/TasksAdminPageClient.tsx`** (lista de clientes + kanban; modal de criação/edição fica no Task 6)

```typescript
"use client";

import { useEffect, useState } from "react";
import { TaskKanbanColumn } from "@/components/admin/tasks/TaskKanbanColumn";
import type { AdminTask } from "@/components/admin/tasks/TaskCard";

type Status = { id: string; name: string; color: string; position: number };
type ClientOption = { id: string; name: string; isTest: boolean };

export function TasksAdminPageClient() {
  const [clients, setClients] = useState<ClientOption[] | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [tasks, setTasks] = useState<AdminTask[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/clients")
      .then((res) => res.json())
      .then((data: { clients: { id: string; name: string; isTest?: boolean }[] }) => {
        const opts = data.clients.map((c) => ({ id: c.id, name: c.name, isTest: Boolean(c.isTest) }));
        setClients(opts);
        if (opts.length > 0) setSelectedClient((prev) => prev ?? opts[0].id);
      });
    fetch("/api/admin/task-statuses")
      .then((res) => res.json())
      .then((data: { statuses: Status[] }) => setStatuses(data.statuses));
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    setTasks(null);
    fetch(`/api/admin/tasks?client=${selectedClient}`)
      .then((res) => res.json())
      .then((data: { tasks: AdminTask[] }) => setTasks(data.tasks));
  }, [selectedClient]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <select
          value={selectedClient ?? ""}
          onChange={(e) => setSelectedClient(e.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        >
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.isTest ? " (teste)" : ""}
            </option>
          ))}
        </select>
      </div>

      {!tasks && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {tasks && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map((s) => (
            <TaskKanbanColumn
              key={s.id}
              name={s.name}
              color={s.color}
              tasks={tasks.filter((t) => t.statusId === s.id)}
              onOpenTask={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Adicionar "Tasks" na sidebar do admin**

Em `src/components/admin/AdminSidebar.tsx`, adicionar um ícone e entrada na lista `ITEMS`:

```typescript
function TasksIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 9l2 2 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

E na array `ITEMS`, antes de `Faturamento`:

```typescript
  { href: "/admin/tasks", label: "Tasks", icon: TasksIcon },
```

- [ ] **Step 6: Checar visualmente**

Run: `npm run dev`, logar como admin, abrir `admin.cliqueboost.io/tasks` (ou `localhost:3000/admin/tasks` conforme o proxy local) — deve mostrar o seletor de cliente e 3 colunas vazias ("A Fazer", "Em Andamento", "Concluído").

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/\(authed\)/tasks src/components/admin/tasks src/components/admin/AdminSidebar.tsx
git commit -m "feat(admin): pagina de tasks (kanban) no admin"
```

---

### Task 6: Admin UI — modal de criar/editar task (checklist, tags, anexos, comentários)

**Files:**
- Create: `src/components/admin/tasks/TaskAdminModal.tsx`
- Create: `src/components/admin/tasks/NewTaskModal.tsx`
- Modify: `src/components/admin/tasks/TasksAdminPageClient.tsx`

**Interfaces:**
- Consumes: `AdminTask` de `TaskCard.tsx`, rotas `/api/admin/tasks/*`, `/api/admin/task-tags`
- Produces: `TaskAdminModal({ task: AdminTask, statuses, onClose, onChanged, onDeleted })`, `NewTaskModal({ clientId, statuses, onClose, onCreated })`

- [ ] **Step 1: `src/components/admin/tasks/NewTaskModal.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { AdminTask } from "@/components/admin/tasks/TaskCard";

export function NewTaskModal({
  clientId,
  statuses,
  onClose,
  onCreated,
}: {
  clientId: string;
  statuses: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (task: AdminTask) => void;
}) {
  const [title, setTitle] = useState("");
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? "");
  const [priority, setPriority] = useState<"urgent" | "high" | "normal" | "low">("normal");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, statusId, title: title.trim(), priority }),
      });
      if (!res.ok) throw new Error();
      const data: { task: AdminTask } = await res.json();
      onCreated(data.task);
      onClose();
    } catch {
      console.error("falha ao criar task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-md bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-sm font-bold text-card-foreground">Nova task</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          autoFocus
          className="mb-3 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
        <div className="mb-4 flex gap-2">
          <select value={statusId} onChange={(e) => setStatusId(e.target.value)} className="flex-1 rounded-md border border-border bg-transparent px-2 py-2 text-sm">
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="flex-1 rounded-md border border-border bg-transparent px-2 py-2 text-sm">
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
            <option value="low">Baixa</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">Cancelar</button>
          <button type="button" onClick={submit} disabled={!title.trim() || saving} className="rounded-md bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {saving ? "Criando..." : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/components/admin/tasks/TaskAdminModal.tsx`** — checklist, tags, anexos, comentários, exclusão

```typescript
"use client";

import { useEffect, useState } from "react";
import type { AdminTask } from "@/components/admin/tasks/TaskCard";

type ChecklistItem = { id: string; label: string; done: boolean };
type Attachment = { id: string; filename: string; url: string };
type Comment = { id: string; body: string; authorType: "admin" | "client"; authorName: string; createdAt: string };
type Tag = { id: string; name: string; color: string };

export function TaskAdminModal({
  task,
  statuses,
  allTags,
  onClose,
  onDeleted,
}: {
  task: AdminTask;
  statuses: { id: string; name: string }[];
  allTags: Tag[];
  onClose: () => void;
  onDeleted: (taskId: string) => void;
}) {
  const [statusId, setStatusId] = useState(task.statusId);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist as ChecklistItem[]);
  const [newItem, setNewItem] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    fetch(`/api/admin/tasks/${task.id}/attachments`)
      .then((res) => res.json())
      .then((data: { attachments: Attachment[] }) => setAttachments(data.attachments));
    fetch(`/api/tasks-internal-comments/${task.id}`).catch(() => {});
  }, [task.id]);

  async function changeStatus(next: string) {
    setStatusId(next);
    await fetch(`/api/admin/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId: next }),
    });
  }

  async function addItem() {
    if (!newItem.trim()) return;
    const res = await fetch(`/api/admin/tasks/${task.id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newItem.trim() }),
    });
    if (res.ok) {
      const data: { item: ChecklistItem } = await res.json();
      setChecklist((prev) => [...prev, data.item]);
      setNewItem("");
    }
  }

  async function toggleItem(item: ChecklistItem) {
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    await fetch(`/api/admin/tasks/${task.id}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
  }

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/admin/tasks/${task.id}/attachments`, { method: "POST", body: formData });
    if (res.ok) {
      const data: { attachment: Attachment } = await res.json();
      setAttachments((prev) => [data.attachment, ...prev]);
    }
  }

  async function remove() {
    if (!confirm("Apagar essa task?")) return;
    await fetch(`/api/admin/tasks/${task.id}`, { method: "DELETE" });
    onDeleted(task.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-y-auto rounded-md bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-card-foreground">{task.title}</h2>
          <button type="button" onClick={remove} className="text-xs font-semibold text-red-600">Apagar</button>
        </div>

        <label className="mb-1 block text-xs font-bold text-card-foreground">Status</label>
        <select value={statusId} onChange={(e) => changeStatus(e.target.value)} className="mb-4 w-full rounded-md border border-border bg-transparent px-2 py-2 text-sm">
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <p className="mb-1 text-xs font-bold text-card-foreground">Checklist</p>
        <ul className="mb-2 space-y-1">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.done} onChange={() => toggleItem(item)} />
              <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
            </li>
          ))}
        </ul>
        <div className="mb-4 flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Novo item"
            className="flex-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
          />
          <button type="button" onClick={addItem} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Adicionar</button>
        </div>

        <p className="mb-1 text-xs font-bold text-card-foreground">Anexos</p>
        <ul className="mb-2 space-y-1">
          {attachments.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-brand-accent underline">{a.filename}</a>
            </li>
          ))}
        </ul>
        <input type="file" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} className="mb-4 text-sm" />

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">Fechar</button>
        </div>
      </div>
    </div>
  );
}
```

Nota: remover a linha solta `fetch("/api/tasks-internal-comments/...")` do Step 2 (sobrou de rascunho) — comentários do admin dentro do modal ficam fora do escopo mínimo desta task (o admin já vê/responde comentário na visão espelho do cliente, `verifyClientSession` aceita admin logado). Deletar essa linha do `useEffect` antes de seguir.

- [ ] **Step 3: Ligar os modais em `TasksAdminPageClient.tsx`**

Adicionar estado `openTask`/`creating`, botão "+ Nova task", `onOpenTask={(t) => setOpenTask(t)}`, renderizar `<NewTaskModal>`/`<TaskAdminModal>` condicionalmente, e recarregar `tasks` (refetch simples) após criar/apagar.

- [ ] **Step 4: Checar visualmente**

Run: `npm run dev` — criar uma task de teste no cliente de teste, marcar item de checklist, subir um anexo, apagar a task. Confirmar que cada ação reflete sem reload.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/tasks
git commit -m "feat(admin): modal de criar/editar task com checklist e anexos"
```

---

### Task 7: Admin — campo `is_test` no formulário de criar cliente

**Files:**
- Modify: `src/app/api/admin/clients/route.ts`
- Modify: `src/components/admin/ClientesPageClient.tsx`

**Interfaces:**
- Modify `POST /api/admin/clients` pra aceitar `isTest?: boolean` no body e gravar em `clients.is_test`; `GET` já devolve todas as colunas de `clients` via `select("*")` então `isTest` já viria se o `map` em `route.ts` (linha ~41-56) incluir o campo.

- [ ] **Step 1: Adicionar `isTest` no GET e no POST de `src/app/api/admin/clients/route.ts`**

No type `AdminClient`, adicionar `isTest: boolean;`. No `.map`, adicionar `isTest: c.is_test,`. No `POST`, ler `const isTest = body?.isTest === true;` e incluir `is_test: isTest` no `.insert(...)` da tabela `clients`.

- [ ] **Step 2: Adicionar checkbox no formulário de criação em `ClientesPageClient.tsx`**

Adicionar um `<input type="checkbox">` rotulado "Cliente de teste (não aparece em faturamento/indicações)" no formulário de criar cliente, e enviar `isTest` no body do `POST`.

- [ ] **Step 3: Verificar build**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/clients/route.ts src/components/admin/ClientesPageClient.tsx
git commit -m "feat(admin): flag de cliente de teste na criacao"
```

---

### Task 8: Criar os 2 clientes de teste

**Files:** nenhum (ação via UI, não código)

- [ ] **Step 1:** Com o admin logado, criar 2 clientes usando o formulário (Task 7), marcando "Cliente de teste": ex. `teste-um` / `teste-dois`. Anotar os slugs usados — vão ser referenciados nos testes manuais das próximas tasks.

Não commitar nada aqui — é dado, não código.

---

### Task 9: Rotas de API do cliente — reescrever pra ler das tabelas novas

**Files:**
- Modify: `src/app/api/tasks/[client]/route.ts`
- Modify: `src/app/api/tasks/[client]/task/[taskId]/status/route.ts`
- Modify: `src/app/api/tasks/[client]/task/[taskId]/comments/route.ts`
- Delete: `src/app/api/tasks/[client]/list-meta/route.ts`
- Delete: `src/app/api/tasks/[client]/task/[taskId]/assignees/route.ts`
- Delete: `src/app/api/tasks/[client]/task/[taskId]/description/route.ts`
- Delete: `src/app/api/tasks/[client]/task/[taskId]/due-date/route.ts`

**Interfaces:**
- Consumes: `verifyClientSession` de `@/lib/access`, `listTasksForClient`/`listStatuses`/`updateTaskStatus`/`listComments`/`addComment`/`getTask` de `@/lib/tasks`, `CLIENTS` de `@/lib/clients` (pra achar `agencyId`... na verdade `clients` não expõe `agency_id` no array hardcoded local — usar `"cliqueboost"` fixo, único valor existente hoje, com um `ponytail:` explicando)

- [ ] **Step 1: Reescrever `src/app/api/tasks/[client]/route.ts`**

```typescript
// src/app/api/tasks/[client]/route.ts
import { CLIENTS } from "@/lib/clients";
import { verifyClientSession } from "@/lib/access";
import { listTasksForClient, listStatuses } from "@/lib/tasks";

// ponytail: agencyId fixo — única agência hoje (Clique Boost); vira dinâmico na virada multi-tenant.
const AGENCY_ID = "cliqueboost";

export async function GET(_request: Request, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const found = CLIENTS.find((c) => c.id === clientId);
  if (!found) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [tasks, statuses] = await Promise.all([listTasksForClient(clientId), listStatuses(AGENCY_ID)]);
  return Response.json({ tasks, statuses });
}
```

- [ ] **Step 2: Reescrever `status/route.ts`** (único campo que o cliente pode mudar)

```typescript
// src/app/api/tasks/[client]/task/[taskId]/status/route.ts
import { CLIENTS } from "@/lib/clients";
import { verifyClientSession } from "@/lib/access";
import { getTask, updateTaskStatus } from "@/lib/tasks";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ client: string; taskId: string }> }
) {
  const { client: clientId, taskId } = await params;
  const found = CLIENTS.find((c) => c.id === clientId);
  if (!found) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const task = await getTask(taskId);
  if (!task || task.clientId !== clientId) return Response.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.statusId !== "string") return Response.json({ error: "status_invalido" }, { status: 400 });

  await updateTaskStatus(taskId, body.statusId);
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Reescrever `comments/route.ts`**

```typescript
// src/app/api/tasks/[client]/task/[taskId]/comments/route.ts
import { CLIENTS } from "@/lib/clients";
import { verifyClientSession } from "@/lib/access";
import { getTask, listComments, addComment } from "@/lib/tasks";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ client: string; taskId: string }> }
) {
  const { client: clientId, taskId } = await params;
  const found = CLIENTS.find((c) => c.id === clientId);
  if (!found) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const comments = await listComments(taskId);
  return Response.json({ comments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ client: string; taskId: string }> }
) {
  const { client: clientId, taskId } = await params;
  const found = CLIENTS.find((c) => c.id === clientId);
  if (!found) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const task = await getTask(taskId);
  if (!task || task.clientId !== clientId) return Response.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const text = body?.text;
  if (typeof text !== "string" || !text.trim()) return Response.json({ error: "invalid_body" }, { status: 400 });

  const comment = await addComment(taskId, { clientId, clientName: found.name }, text.trim());
  return Response.json({ comment });
}
```

- [ ] **Step 4: Apagar as rotas que não existem mais**

```bash
git rm src/app/api/tasks/\[client\]/list-meta/route.ts
git rm src/app/api/tasks/\[client\]/task/\[taskId\]/assignees/route.ts
git rm src/app/api/tasks/\[client\]/task/\[taskId\]/description/route.ts
git rm src/app/api/tasks/\[client\]/task/\[taskId\]/due-date/route.ts
```

- [ ] **Step 5: Verificar build**

Run: `npx tsc --noEmit`
Expected: erros apontando os componentes que ainda importam essas rotas/tipos antigos (`TaskDetailModal.tsx`, `TasksTable.tsx`, etc.) — corrigidos na Task 10.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/api/tasks
git commit -m "feat(dashboard): rotas de tasks do cliente lendo das tabelas nativas"
```

---

### Task 10: UI do cliente — reescrever pra ler das tabelas novas com edição restrita

**Files:**
- Modify: `src/components/tasks/TasksPageClient.tsx`
- Modify: `src/components/tasks/TasksTable.tsx`
- Modify: `src/components/tasks/TaskRow.tsx`
- Modify: `src/components/tasks/TaskDetailModal.tsx`
- Modify: `src/components/tasks/PriorityFlag.tsx`
- Modify: `src/components/tasks/StatusIcon.tsx`

**Interfaces:**
- Produces: tipo local `ClientTask` (substitui `TaskItem` de `@/lib/clickup` nesses componentes) — `{ id: string; title: string; description: string; priority: "urgent"|"high"|"normal"|"low"; statusId: string; dueAt: string | null; tags: { id: string; name: string; color: string }[]; checklist: { id: string; label: string; done: boolean }[] }` e `ClientTaskStatus = { id: string; name: string; color: string }`

- [ ] **Step 1: Ler o estado atual de `TasksTable.tsx`, `TaskRow.tsx`, `PriorityFlag.tsx`, `StatusIcon.tsx`**

Antes de editar, abrir os 4 arquivos pra mapear exatamente onde usam `TaskItem`/`TaskStatus`/`StatusType` de `@/lib/clickup` — cada `import type { ... } from "@/lib/clickup"` vira `import type { ClientTask, ClientTaskStatus } from "@/components/tasks/types"`.

- [ ] **Step 2: Criar `src/components/tasks/types.ts`**

```typescript
// src/components/tasks/types.ts
export type Priority = "urgent" | "high" | "normal" | "low";
export type ClientTaskTag = { id: string; name: string; color: string };
export type ClientChecklistItem = { id: string; label: string; done: boolean };
export type ClientTask = {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  statusId: string;
  dueAt: string | null;
  tags: ClientTaskTag[];
  checklist: ClientChecklistItem[];
};
export type ClientTaskStatus = { id: string; name: string; color: string };

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgente",
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};
export const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "#ef4444",
  high: "#f59e0b",
  normal: "#94a3b8",
  low: "#64748b",
};
```

- [ ] **Step 3: Atualizar `TasksPageClient.tsx`** — trocar `import type { TaskItem, TaskStatus } from "@/lib/clickup"` por `import type { ClientTask, ClientTaskStatus } from "@/components/tasks/types"`, renomear os usos (`TaskItem` → `ClientTask`, `TaskStatus` → `ClientTaskStatus`), manter o resto do componente igual (já busca de `/api/tasks/${clientId}`, que agora devolve o shape novo).

- [ ] **Step 4: Atualizar `TasksTable.tsx` e `TaskRow.tsx`** — mesma troca de tipos; onde usarem `task.name` trocar pra `task.title`, onde usarem `task.status`/`task.statusColor` (string) trocar pra resolver o status pelo `statusId` contra a lista de `statuses` recebida via prop (já existe esse prop, só muda a leitura).

- [ ] **Step 5: Atualizar `PriorityFlag.tsx`** — receber `priority: Priority` (do `types.ts`) em vez do `TaskPriority` do ClickUp (que tinha `label`/`color` prontos); resolver `PRIORITY_LABEL`/`PRIORITY_COLOR` de `types.ts` internamente.

- [ ] **Step 6: Atualizar `StatusIcon.tsx`** — se dependia de `StatusType` (`open|custom|closed`) do ClickUp pra escolher o ícone, simplificar pra usar a **posição** do status na lista (`position === 0` → não iniciado, último → concluído, meio → em andamento) já que o novo `task_statuses` não tem esse campo de tipo. Documentar a decisão com `ponytail:` no arquivo.

- [ ] **Step 7: Reescrever `TaskDetailModal.tsx`** — reduzir a área editável: manter `StatusField` (agora seleciona entre `ClientTaskStatus[]`, chamando `POST /api/tasks/[client]/task/[taskId]/status` com `{ statusId }`) e `CommentsField`/`CommentBox` (já compatíveis, só trocam tipo). **Remover** `AssigneesField`, `DueDateField` (editável) e `DescriptionField` (editável) — viram campos de **leitura**: prazo exibido como texto (`formatDate(task.dueAt)`), descrição exibida como texto (`task.description`), sem botão "Editar". Adicionar exibição de **checklist** (lista com checkbox desabilitado — cliente só visualiza, não risca) e **tags** (já existia leitura de tags, só troca a fonte do dado).

- [ ] **Step 8: Verificar build**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero erros/warnings novos.

- [ ] **Step 9: Checar visualmente**

Run: `npm run dev`, logar como um dos clientes de teste, abrir `/tasks`: kanban vazio (sem tasks ainda). Como admin, criar uma task pro cliente de teste (Task 6), voltar pro dashboard do cliente, confirmar que a task aparece, o cliente consegue mudar status e comentar, mas não vê botão de editar título/prazo/descrição.

- [ ] **Step 10: Commit**

```bash
git add src/components/tasks
git commit -m "feat(dashboard): tasks do cliente lendo do banco nativo, edicao restrita a status e comentario"
```

---

### Task 11: Retirar `lib/clickup.ts` do caminho crítico (sem apagar ainda)

**Files:**
- Modify: `ARCHITECTURE.md`

**Interfaces:** nenhuma nova — só documentação.

- [ ] **Step 1:** Atualizar a seção "Dívidas conhecidas" do `ARCHITECTURE.md`: registrar que `lib/clickup.ts` não é mais consumido por `/{client}/tasks` nem por nenhuma rota de API (ficou órfão), mas o arquivo continua no repo até a Fase 2 estar validada em produção com clientes reais — remover código morto é tarefa separada, depois da virada confirmada.

- [ ] **Step 2: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: registra lib/clickup.ts como orfao pos-fase-2"
```

---

## Self-Review (feito ao escrever este plano)

- **Cobertura da spec:** modelo de dados (Task 1-2), permissões admin-CRUD/cliente-status+comentário (Task 3-4 vs. Task 9-10), 2 clientes de teste (Task 7-8), sem importação do ClickUp (nenhuma task de import), virada por cliente (Task 9-10 trocam a fonte de dado da rota do cliente diretamente — não há mais leitura híbrida, o corte é atômico por definição já que não existe mais chamada a `lib/clickup.ts` nessas rotas). Coberto.
- **Placeholder scan:** sem TBD/TODO; todo passo tem código completo.
- **Consistência de tipos:** `NativeTask`/`AdminTask`/`ClientTask` têm formas ligeiramente diferentes de propósito (admin vê `assigneeAdminUserId`, cliente não) — isso é a barreira de permissão, não inconsistência acidental; os campos compartilhados (`id`, `title`/`name`, `priority`, `statusId`, `dueAt`, `tags`, `checklist`) usam os mesmos nomes nas duas pontas.
