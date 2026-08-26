import { verifyAdminRequest } from "@/lib/adminSession";
import { toggleChecklistItem, deleteChecklistItem } from "@/lib/tasks";

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { itemId } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.done !== "boolean") return Response.json({ error: "done_invalido" }, { status: 400 });
  await toggleChecklistItem(itemId, body.done);
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { itemId } = await params;
  await deleteChecklistItem(itemId);
  return Response.json({ ok: true });
}
