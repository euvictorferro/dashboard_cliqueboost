// src/app/api/admin/clients/route.ts
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminRequest } from "@/lib/adminSession";

const SLUG_RE = /^[a-z0-9-]{2,30}$/;

type AdminClient = {
  id: string;
  name: string;
  active: boolean;
  instagramBusinessId: string | null;
  clickupListId: string | null;
  trelloBoardId: string | null;
  adAccountId: string | null;
  adsActive: boolean;
  planName: string | null;
  paymentStatus: string | null;
  hasLogin: boolean;
};

export async function GET() {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });

  const [{ data: clients, error: clientsError }, { data: settings }, { data: accounts }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("client_settings").select("client_id, plan_name, payment_status"),
    supabase.from("client_accounts").select("client_id"),
  ]);
  if (clientsError || !clients) {
    // fail-safe: migration 0024 ainda não rodou
    return Response.json({ error: "tabela_clients_indisponivel" }, { status: 503 });
  }

  const settingsByClient = new Map((settings ?? []).map((s) => [s.client_id, s]));
  const loginClientIds = new Set((accounts ?? []).map((a) => a.client_id));

  const result: AdminClient[] = clients.map((c) => {
    const s = settingsByClient.get(c.id);
    return {
      id: c.id,
      name: c.name,
      active: c.active,
      instagramBusinessId: c.instagram_business_id,
      clickupListId: c.clickup_list_id,
      trelloBoardId: c.trello_board_id,
      adAccountId: c.ad_account_id,
      adsActive: c.ads_active,
      planName: s?.plan_name ?? null,
      paymentStatus: s?.payment_status ?? null,
      hasLogin: loginClientIds.has(c.id),
    };
  });

  return Response.json({ clients: result });
}

export async function POST(request: Request) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = body?.id;
  const name = body?.name;
  const email = body?.email;
  const password = body?.password;
  const instagramBusinessId = body?.instagramBusinessId ?? null;
  const clickupListId = body?.clickupListId ?? null;
  const trelloBoardId = body?.trelloBoardId ?? null;

  if (typeof id !== "string" || !SLUG_RE.test(id)) {
    return Response.json({ error: "id_invalido" }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "nome_invalido" }, { status: 400 });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "email_invalido" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return Response.json({ error: "senha_invalida" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });

  const { data: existing } = await supabase.from("clients").select("id").eq("id", id).maybeSingle();
  if (existing) return Response.json({ error: "id_duplicado" }, { status: 409 });

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    return Response.json({ error: "falha_criar_usuario", detail: authError?.message }, { status: 500 });
  }
  const userId = authData.user.id;

  // Se qualquer passo abaixo falhar, desfaz o auth user criado — sem usuário órfão.
  const db = supabase;
  async function rollback() {
    await db.auth.admin.deleteUser(userId);
  }

  const { error: clientError } = await supabase.from("clients").insert({
    id,
    agency_id: admin.agencyId,
    name: name.trim(),
    instagram_business_id: instagramBusinessId,
    clickup_list_id: clickupListId,
    trello_board_id: trelloBoardId,
  });
  if (clientError) {
    await rollback();
    return Response.json({ error: "falha_criar_cliente", detail: clientError.message }, { status: 500 });
  }

  const { error: accountError } = await supabase.from("client_accounts").insert({ user_id: userId, client_id: id });
  if (accountError) {
    await supabase.from("clients").delete().eq("id", id);
    await rollback();
    return Response.json({ error: "falha_criar_conta", detail: accountError.message }, { status: 500 });
  }

  const { error: settingsError } = await supabase.from("client_settings").insert({ client_id: id });
  if (settingsError) {
    await supabase.from("client_accounts").delete().eq("user_id", userId);
    await supabase.from("clients").delete().eq("id", id);
    await rollback();
    return Response.json({ error: "falha_criar_configuracoes", detail: settingsError.message }, { status: 500 });
  }

  return Response.json({ ok: true, id, email, password });
}
