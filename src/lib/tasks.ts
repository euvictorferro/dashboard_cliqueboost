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
