import { verifyAdminRequest } from "@/lib/adminSession";
import { listTags, createTag } from "@/lib/tasks";

export async function GET() {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const tags = await listTags(admin.agencyId);
  return Response.json({ tags });
}

export async function POST(request: Request) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const name = body?.name;
  const color = body?.color;
  if (typeof name !== "string" || !name.trim()) return Response.json({ error: "nome_invalido" }, { status: 400 });
  if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return Response.json({ error: "cor_invalida" }, { status: 400 });
  }
  const tag = await createTag(admin.agencyId, name.trim(), color);
  return Response.json({ tag });
}
