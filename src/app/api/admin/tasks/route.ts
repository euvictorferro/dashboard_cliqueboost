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
