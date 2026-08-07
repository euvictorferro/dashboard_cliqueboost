// src/app/api/admin/billing/route.ts
import { verifyAdminRequest } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { getClients } from "@/lib/clients";

type BillingRow = {
  clientId: string;
  name: string;
  planName: string | null;
  paymentStatus: string | null;
  stripeLinked: boolean;
  lastPaymentAt: string | null;
  lastPaymentAmount: number | null;
};

export async function GET() {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });

  const [clients, { data: settings }, { data: payments }] = await Promise.all([
    getClients(),
    supabase.from("client_settings").select("client_id, plan_name, payment_status, stripe_customer_id"),
    supabase.from("client_payments").select("client_id, paid_at, amount").order("paid_at", { ascending: false }),
  ]);

  const settingsByClient = new Map((settings ?? []).map((s) => [s.client_id, s]));
  const lastPaymentByClient = new Map<string, { paid_at: string; amount: number | null }>();
  for (const p of payments ?? []) {
    if (!lastPaymentByClient.has(p.client_id)) lastPaymentByClient.set(p.client_id, p);
  }

  const rows: BillingRow[] = clients.map((c) => {
    const s = settingsByClient.get(c.id);
    const lastPayment = lastPaymentByClient.get(c.id);
    return {
      clientId: c.id,
      name: c.name,
      planName: s?.plan_name ?? null,
      paymentStatus: s?.payment_status ?? null,
      stripeLinked: !!s?.stripe_customer_id,
      lastPaymentAt: lastPayment?.paid_at ?? null,
      lastPaymentAmount: lastPayment?.amount ?? null,
    };
  });

  // MRR: soma das assinaturas ativas no Stripe. Sem Stripe configurado, a UI mostra "—".
  let mrr: number | null = null;
  const stripe = getStripe();
  if (stripe) {
    try {
      const subs = await stripe.subscriptions.list({ status: "active", limit: 100 });
      mrr = subs.data.reduce((sum, sub) => sum + (sub.items.data[0]?.price?.unit_amount ?? 0), 0) / 100;
    } catch (err) {
      console.error("[admin-billing] falha ao buscar assinaturas do Stripe:", err);
    }
  }

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const paymentsThisMonth = (payments ?? []).filter((p) => p.paid_at.startsWith(currentMonthKey)).length;

  return Response.json({
    mrr,
    activeClients: clients.length,
    paymentsThisMonth,
    clients: rows,
  });
}
