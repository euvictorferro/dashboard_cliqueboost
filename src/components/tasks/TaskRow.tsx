// src/components/TaskRow.tsx
"use client";

import type { ClientTask, ClientTaskStatus } from "@/components/tasks/types";
import { getDueDateDisplay } from "@/lib/dateDisplay";
import { StatusIcon } from "@/components/tasks/StatusIcon";
import { PriorityFlag } from "@/components/tasks/PriorityFlag";

export function TaskRow({
  task,
  statuses,
  onClick,
}: {
  task: ClientTask;
  statuses: ClientTaskStatus[];
  onClick: () => void;
}) {
  const dueDisplay = task.dueAt !== null ? getDueDateDisplay(new Date(task.dueAt).getTime()) : null;
  const status = statuses.find((s) => s.id === task.statusId);

  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[minmax(0,1fr)_130px_110px_80px] items-center gap-3 border-t border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
    >
      <span className="flex min-w-0 items-center gap-2">
        <StatusIcon statusId={task.statusId} statuses={statuses} color={status?.color ?? "#94a3b8"} />
        <span className="truncate text-card-foreground">{task.title}</span>
      </span>
      <span>
        <span
          className="inline-block truncate rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: status?.color ?? "#94a3b8" }}
        >
          {status?.name ?? "—"}
        </span>
      </span>
      <span className={`text-xs ${dueDisplay?.className ?? "text-muted-foreground"}`}>{dueDisplay?.text ?? "—"}</span>
      <span>
        <PriorityFlag priority={task.priority} />
      </span>
    </button>
  );
}
