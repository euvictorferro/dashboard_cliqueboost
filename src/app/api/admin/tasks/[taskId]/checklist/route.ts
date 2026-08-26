import { verifyAdminRequest } from "@/lib/adminSession";
import { addChecklistItem } from "@/lib/tasks";

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { taskId } = await params;
  const body = await request.json().catch(() => null);
  const label = body?.label;
  if (typeof label !== "string" || !label.trim()) return Response.json({ error: "label_invalido" }, { status: 400 });
  const item = await addChecklistItem(taskId, label.trim());
  return Response.json({ item });
}
