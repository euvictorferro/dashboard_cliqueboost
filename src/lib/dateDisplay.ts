const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ponytail: usado no ContentCard e no TaskRow — data curta no ano corrente, completa
// se for outro ano, cor por proximidade (vermelho vencido, amarelo <=3 dias, neutro caso contrário).
export function getDueDateDisplay(dueDate: number): { text: string; className: string } {
  const due = new Date(dueDate);
  const now = new Date();
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysDiff = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  const text =
    due.getFullYear() === now.getFullYear()
      ? `${String(due.getDate()).padStart(2, "0")} ${MONTHS_PT[due.getMonth()]}`
      : due.toLocaleDateString("pt-BR");

  const className = daysDiff < 0 ? "text-red-400" : daysDiff <= 3 ? "text-amber-400" : "";

  return { text, className };
}
