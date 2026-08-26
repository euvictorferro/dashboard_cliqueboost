import { verifyAdminRequest } from "@/lib/adminSession";
import { listStatuses } from "@/lib/tasks";

export async function GET() {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const statuses = await listStatuses(admin.agencyId);
  return Response.json({ statuses });
}
