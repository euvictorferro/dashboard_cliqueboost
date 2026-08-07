// src/components/StatusIcon.tsx
import type { StatusType } from "@/lib/clickup";

// ponytail: 3 variantes visuais por type — bolinha tracejada (não iniciado), meia-lua
// preenchida (em andamento), bolinha cheia com check (concluído). Cor vem de fora
// (task.statusColor), já resolvida com o fallback de var(--cu-status-*) em clickup.ts.
export function StatusIcon({ type, color, size = 12 }: { type: StatusType; color: string; size?: number }) {
  if (type === "open") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="6" cy="6" r="5" stroke={color} strokeWidth="1.4" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (type === "closed") {
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
