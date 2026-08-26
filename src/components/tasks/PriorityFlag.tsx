// src/components/PriorityFlag.tsx
import { PRIORITY_LABEL, PRIORITY_COLOR, type Priority } from "@/components/tasks/types";

export function PriorityFlag({ priority, size = 12 }: { priority: Priority; size?: number }) {
  const color = PRIORITY_COLOR[priority];
  return (
    <span title={PRIORITY_LABEL[priority]}>
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
        <path d="M2.5 1v10" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M2.5 1.5h6.5l-1.8 2.25L9 6H2.5Z" fill={color} />
      </svg>
    </span>
  );
}
