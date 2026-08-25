// src/app/api/referrals/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { createReferralLead } from "@/lib/referralLeads";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  // Rota pública — sem limite vira alvo de spam de leads. 5 envios por IP a cada 15 min.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!(await checkRateLimit(`referral-lead:${ip}`, 900, 5))) {
    return Response.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const referrerClientId = body?.referrerClientId;
  const name = body?.name;
  const contact = body?.contact;

  if (typeof referrerClientId !== "string" || !CLIENTS.some((c) => c.id === referrerClientId)) {
    return Response.json({ error: "unknown_referrer" }, { status: 404 });
  }
  if (typeof name !== "string" || name.trim().length === 0 || typeof contact !== "string" || contact.trim().length === 0) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await createReferralLead(referrerClientId, name.trim(), contact.trim());
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[referrals] falha ao salvar lead indicado por ${referrerClientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
