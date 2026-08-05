import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientToken } from "@/lib/access";
import { getPendingRatingMonth, createRating } from "@/lib/ratings";

function isValidStars(value: unknown): value is number {
  return typeof value === "number" && value >= 0.5 && value <= 5 && value * 2 === Math.round(value * 2);
}

function isValidMonthRef(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-01$/.test(value);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const monthRef = await getPendingRatingMonth(clientId);
  return Response.json({ show: monthRef !== null, monthRef });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !isValidMonthRef(body.month_ref) || !isValidStars(body.stars)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const feedback = typeof body.feedback === "string" && body.feedback.trim().length > 0 ? body.feedback.trim() : null;

  const pendingMonth = await getPendingRatingMonth(clientId);
  if (pendingMonth !== body.month_ref) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await createRating(clientId, body.month_ref, body.stars, feedback);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[ratings] falha ao salvar rating de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
