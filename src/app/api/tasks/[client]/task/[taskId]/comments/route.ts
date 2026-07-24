import { NextRequest } from "next/server";
import { fetchTaskComments, hasClickUpCredentials, postTaskComment } from "@/lib/clickup";
import { verifyClientToken } from "@/lib/access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; taskId: string }> },
) {
  const { client: clientId, taskId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasClickUpCredentials()) {
    console.error("[tasks] CLICKUP_API_TOKEN não configurado (comments GET)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  try {
    const comments = await fetchTaskComments(taskId);
    return Response.json({ comments });
  } catch (err) {
    console.error(`[tasks] falha ao buscar comentários da task ${taskId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}

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
    console.error("[tasks] CLICKUP_API_TOKEN não configurado (comments POST)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { text } = await request.json();
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const comment = await postTaskComment(taskId, text.trim());
    return Response.json({ comment });
  } catch (err) {
    console.error(`[tasks] falha ao postar comentário na task ${taskId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
