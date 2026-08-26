// src/components/StatusIcon.tsx
import type { ClientTaskStatus } from "@/components/tasks/types";

// ponytail: task_statuses não carrega mais um "tipo" semântico (open/custom/closed) como no
// ClickUp — só nome/cor/posição. Infere o estágio pela posição na lista ordenada: primeiro
// status = não iniciado, último = concluído, qualquer um no meio = em andamento. Fica errado
// se uma agência tiver só 1 ou 2 statuses no board, mas isso já degrada bem (1 status = sempre
// "concluído"). Voltar a ter um campo semântico por status é upgrade pra quando isso incomodar.
export function StatusIcon({
  statusId,
  statuses,
  color,
  size = 12,
}: {
  statusId: string;
  statuses: ClientTaskStatus[];
  color: string;
  size?: number;
}) {
  const index = statuses.findIndex((s) => s.id === statusId);
  const isFirst = index === 0;
  const isLast = index === statuses.length - 1;

  if (isFirst && !isLast) {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="6" cy="6" r="5" stroke={color} strokeWidth="1.4" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (isLast) {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="6" cy="6" r="5" fill={color} />
        <path
          d="M3.5 6.2l1.7 1.7L8.5 4.3"
          stroke="white"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="6" cy="6" r="5" stroke={color} strokeWidth="1.4" />
      <path d="M6 1a5 5 0 0 1 0 10Z" fill={color} />
    </svg>
  );
}
