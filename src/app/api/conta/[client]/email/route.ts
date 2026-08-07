// src/app/api/conta/[client]/email/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { updateContactEmail } from "@/lib/clientSettings";
import { verifyClientSession } from "@/lib/access";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PUT(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const email = body?.email;
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await updateContactEmail(clientId, email);
    return Response.json({ email });
  } catch (err) {
    console.error(`[conta] falha ao salvar e-mail de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
