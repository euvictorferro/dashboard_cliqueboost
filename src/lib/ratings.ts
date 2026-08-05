import { getSupabaseAdmin } from "./supabase";

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function monthRefOf(year: number, monthIndex0: number): string {
  const mm = String(monthIndex0 + 1).padStart(2, "0");
  return `${year}-${mm}-01`;
}

// Mês alvo = mês corrente, se hoje está nos últimos 3 dias dele e ele ainda não foi avaliado;
// senão, mês anterior, se ele ainda não foi avaliado (cobre quem não abriu o app nos últimos
// 3 dias daquele mês). Se ambos já avaliados (ou nenhum se aplica), não há pendência.
export function computePendingMonth(
  now: Date,
  ratedMonths: string[]
): string | null {
  const rated = new Set(ratedMonths);
  const year = now.getFullYear();
  const monthIndex0 = now.getMonth();
  const day = now.getDate();
  const lastDay = lastDayOfMonth(year, monthIndex0);

  const currentMonthRef = monthRefOf(year, monthIndex0);
  const isInLastThreeDays = day > lastDay - 3;
  if (isInLastThreeDays && !rated.has(currentMonthRef))
    return currentMonthRef;

  const prevMonthIndex0 = monthIndex0 === 0 ? 11 : monthIndex0 - 1;
  const prevYear = monthIndex0 === 0 ? year - 1 : year;
  const prevMonthRef = monthRefOf(prevYear, prevMonthIndex0);
  if (!rated.has(prevMonthRef)) return prevMonthRef;

  return null;
}

// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service
// Role Key via getSupabaseAdmin).
export async function getPendingRatingMonth(
  clientId: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("client_ratings")
    .select("month_ref")
    .eq("client_id", clientId);
  const ratedMonths = (data ?? []).map((r) => r.month_ref as string);
  return computePendingMonth(new Date(), ratedMonths);
}

export async function createRating(
  clientId: string,
  monthRef: string,
  stars: number,
  feedback: string | null
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("client_ratings")
    .insert({ client_id: clientId, month_ref: monthRef, stars, feedback });
  // violação de unique(client_id, month_ref) = duplo-envio do mesmo formulário (duplo-clique,
  // retry de rede); a avaliação já foi gravada antes, então trata como sucesso (idempotência).
  if (error && error.code !== "23505") throw new Error(error.message);
}
