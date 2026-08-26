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
