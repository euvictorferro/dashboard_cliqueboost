// src/components/TaskRow.tsx
"use client";

import type { TaskItem } from "@/lib/clickup";
import { getDueDateDisplay } from "@/lib/dateDisplay";
import { AssigneeAvatars } from "@/components/ui/AssigneeAvatars";
import { StatusIcon } from "@/components/tasks/StatusIcon";
import { PriorityFlag } from "@/components/tasks/PriorityFlag";

export function TaskRow({ task, onClick }: { task: TaskItem; onClick: () => void }) {
  const dueDisplay = task.dueDate !== null ? getDueDateDisplay(task.dueDate) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[minmax(0,1fr)_130px_110px_90px_80px] items-center gap-3 border-t border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
    >
      <span className="flex min-w-0 items-center gap-2">
        <StatusIcon type={task.statusType} color={task.statusColor} />
        <span className="truncate text-card-foreground">{task.name}</span>
      </span>
      <span>
        <span
          className="inline-block truncate rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: task.statusColor }}
        >
          {task.status}
        </span>
      </span>
      <span className={`text-xs ${dueDisplay?.className ?? "text-muted-foreground"}`}>{dueDisplay?.text ?? "—"}</span>
      <span>
        <AssigneeAvatars assignees={task.assignees} size="xs" />
      </span>
      <span>
        <PriorityFlag priority={task.priority} />
      </span>
    </button>
  );
}
