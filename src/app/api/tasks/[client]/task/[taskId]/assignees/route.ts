import { NextRequest } from "next/server";
import { addTaskAssignee, hasClickUpCredentials, removeTaskAssignee } from "@/lib/clickup";
import { verifyClientSession } from "@/lib/access";

async function auth(clientId: string) {
  if (!(await verifyClientSession(clientId))) return { error: "unauthorized" as const, status: 401 };
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
  const authError = await auth(clientId);
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
  const authError = await auth(clientId);
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
