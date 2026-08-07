// src/app/api/admin/referrals/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { fetchAllReferralLeads } from "@/lib/referralLeads";
import { getClients } from "@/lib/clients";

export async function GET() {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const [leads, clients] = await Promise.all([fetchAllReferralLeads(), getClients()]);
    const nameById = new Map(clients.map((c) => [c.id, c.name]));
    const result = leads.map((lead) => ({
      ...lead,
      referrerName: nameById.get(lead.referrerClientId) ?? lead.referrerClientId,
      convertedName: lead.convertedClientId ? nameById.get(lead.convertedClientId) ?? lead.convertedClientId : null,
    }));
    return Response.json({ leads: result });
  } catch (err) {
    return Response.json({ error: "falha_buscar_indicacoes", detail: (err as Error).message }, { status: 500 });
  }
}
