// src/app/api/admin/referrals/[id]/convert/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { markConverted } from "@/lib/referralLeads";
import { getClient } from "@/lib/clients";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const convertedClientId = body?.convertedClientId;
  if (typeof convertedClientId !== "string" || !convertedClientId) {
    return Response.json({ error: "cliente_invalido" }, { status: 400 });
  }

  const client = await getClient(convertedClientId);
  if (!client) return Response.json({ error: "cliente_nao_encontrado" }, { status: 404 });

  try {
    await markConverted(id, convertedClientId);
    return Response.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message;
    if (message === "lead_ja_premiado") return Response.json({ error: "lead_ja_premiado" }, { status: 409 });
    if (message === "lead_nao_encontrado") return Response.json({ error: "lead_nao_encontrado" }, { status: 404 });
    return Response.json({ error: "falha_converter", detail: message }, { status: 500 });
  }
}
