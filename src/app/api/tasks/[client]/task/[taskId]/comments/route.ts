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

  const task = await getTask(taskId);
  if (!task || task.clientId !== clientId) return Response.json({ error: "not_found" }, { status: 404 });

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
