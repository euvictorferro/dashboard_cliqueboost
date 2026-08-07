// src/app/api/admin/clients/[id]/route.ts
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminRequest } from "@/lib/adminSession";

const CLIENT_FIELDS = ["name", "instagramBusinessId", "clickupListId", "trelloBoardId", "adAccountId", "adsActive", "active"] as const;
const CLIENT_COLUMN: Record<(typeof CLIENT_FIELDS)[number], string> = {
  name: "name",
  instagramBusinessId: "instagram_business_id",
  clickupListId: "clickup_list_id",
  trelloBoardId: "trello_board_id",
  adAccountId: "ad_account_id",
  adsActive: "ads_active",
  active: "active",
};

const SETTINGS_FIELDS = ["planName", "paymentStatus", "stripeCustomerId", "stripeSubscriptionId"] as const;
const SETTINGS_COLUMN: Record<(typeof SETTINGS_FIELDS)[number], string> = {
  planName: "plan_name",
  paymentStatus: "payment_status",
  stripeCustomerId: "stripe_customer_id",
  stripeSubscriptionId: "stripe_subscription_id",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) return Response.json({ error: "cliente_nao_encontrado" }, { status: 404 });

  const { data: settings } = await supabase.from("client_settings").select("*").eq("client_id", id).maybeSingle();

  return Response.json({ client, settings: settings ?? null });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "corpo_invalido" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });

  // Ignora chaves desconhecidas — só grava o que a UI manda e que pertence a um dos dois updates.
  const clientUpdate: Record<string, unknown> = {};
  for (const field of CLIENT_FIELDS) {
    if (field in body) clientUpdate[CLIENT_COLUMN[field]] = body[field];
  }
  const settingsUpdate: Record<string, unknown> = {};
  for (const field of SETTINGS_FIELDS) {
    if (field in body) settingsUpdate[SETTINGS_COLUMN[field]] = body[field];
  }

  if (Object.keys(clientUpdate).length > 0) {
    const { error } = await supabase.from("clients").update(clientUpdate).eq("id", id);
    if (error) return Response.json({ error: "falha_atualizar_cliente", detail: error.message }, { status: 500 });
  }
  if (Object.keys(settingsUpdate).length > 0) {
    const { error } = await supabase.from("client_settings").upsert({ client_id: id, ...settingsUpdate });
    if (error) return Response.json({ error: "falha_atualizar_configuracoes", detail: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
