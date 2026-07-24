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
