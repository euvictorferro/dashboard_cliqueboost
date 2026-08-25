import { getSupabaseAdmin } from "./supabase";

function monthRefOf(year: number, monthIndex0: number): string {
  const mm = String(monthIndex0 + 1).padStart(2, "0");
  return `${year}-${mm}-01`;
}

// Último dia útil do mês: começa no último dia do calendário e volta até sair de sáb/dom.
function lastBusinessDay(year: number, monthIndex0: number): number {
  let day = new Date(year, monthIndex0 + 1, 0).getDate();
  let weekday = new Date(year, monthIndex0, day).getDay();
  while (weekday === 0 || weekday === 6) {
    day -= 1;
    weekday = new Date(year, monthIndex0, day).getDay();
  }
  return day;
}

// Só pede avaliação do mês corrente no próprio último dia útil dele, e só se ainda não foi
// avaliado. ponytail: sem catch-up de meses anteriores — quem não abrir o app nesse dia
// específico não vê o popup até o último dia útil do mês seguinte. Simplicidade > cobertura
// total; a versão anterior (últimos 3 dias + fallback pro mês anterior) foi trocada porque
// ficava pedindo avaliação de um mês já encerrado o mês inteiro seguinte.
export function computePendingMonth(
  now: Date,
  ratedMonths: string[]
): string | null {
  const rated = new Set(ratedMonths);
  const year = now.getFullYear();
  const monthIndex0 = now.getMonth();
  const monthRef = monthRefOf(year, monthIndex0);

  if (now.getDate() === lastBusinessDay(year, monthIndex0) && !rated.has(monthRef)) {
    return monthRef;
  }
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
