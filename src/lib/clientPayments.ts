// src/lib/clientPayments.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export type ClientPayment = { id: string; paidAt: string; amount: number | null };

export async function fetchClientPayments(clientId: string): Promise<ClientPayment[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("client_payments")
    .select("id, paid_at, amount")
    .eq("client_id", clientId)
    .order("paid_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, paidAt: row.paid_at, amount: row.amount }));
}
