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
