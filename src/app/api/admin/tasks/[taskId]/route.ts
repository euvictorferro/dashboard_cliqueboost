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
