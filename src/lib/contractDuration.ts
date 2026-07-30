// src/lib/contractDuration.ts
export function formatContractDuration(startDate: string | null, now: Date): string {
  if (!startDate) return "Ainda não configurado";

  const start = new Date(startDate + "T00:00:00Z");
  let months =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
  if (now.getUTCDate() < start.getUTCDate()) months -= 1;
  if (months < 0) months = 0;

  if (months < 12) {
    return months === 1 ? "1 mês" : `${months} meses`;
  }

  const years = Math.floor(months / 12);
  const remainderMonths = months % 12;
  const yearsLabel = years === 1 ? "1 ano" : `${years} anos`;
  if (remainderMonths === 0) return yearsLabel;
  const monthsLabel = remainderMonths === 1 ? "1 mês" : `${remainderMonths} meses`;
  return `${yearsLabel} e ${monthsLabel}`;
}
