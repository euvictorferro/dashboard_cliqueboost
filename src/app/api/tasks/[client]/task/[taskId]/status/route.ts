import { NextRequest } from "next/server";
import { hasClickUpCredentials, updateTaskStatus } from "@/lib/clickup";
import { verifyClientSession } from "@/lib/access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; taskId: string }> },
) {
  const { client: clientId, taskId } = await params;

  if (!(await verifyClientSession(clientId))) {
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
