// src/components/PriorityFlag.tsx
import type { TaskPriority } from "@/lib/clickup";

// ponytail: cor vem direto de priority.color (já é a cor real que o ClickUp devolve pra essa
// prioridade) — sem paleta própria. Sem prioridade -> não renderiza nada (célula vazia na tabela).
export function PriorityFlag({ priority, size = 12 }: { priority: TaskPriority | null; size?: number }) {
  if (!priority) return null;
  return (
    <span title={priority.label}>
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
        <path d="M2.5 1v10" stroke={priority.color} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M2.5 1.5h6.5l-1.8 2.25L9 6H2.5Z" fill={priority.color} />
      </svg>
    </span>
  );
}
