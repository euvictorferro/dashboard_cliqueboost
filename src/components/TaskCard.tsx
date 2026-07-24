// src/components/TaskCard.tsx
"use client";

import type { TaskItem } from "@/lib/clickup";
import { getDueDateDisplay } from "@/lib/dateDisplay";
import { AssigneeAvatars } from "./AssigneeAvatars";
import { ClockIcon, DescriptionIcon } from "./icons";

export function TaskCard({ task, onClick }: { task: TaskItem; onClick: () => void }) {
  const dueDisplay = task.dueDate !== null ? getDueDateDisplay(task.dueDate) : null;
  const hasMeta = task.dueDate !== null || task.description !== "" || task.assignees.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full overflow-hidden rounded-[var(--radius-card)] bg-card p-2.5 text-left shadow-[var(--shadow-soft)] transition-colors hover:bg-card/80"
    >
      {(task.priority || task.tags.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.priority && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: task.priority.color }}
            >
              {task.priority.label}
            </span>
          )}
          {task.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}
      <p className="text-sm font-medium text-card-foreground">{task.name}</p>
      {hasMeta && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {dueDisplay && (
            <span className={`flex items-center gap-1 ${dueDisplay.className}`}>
              <ClockIcon />
              {dueDisplay.text}
            </span>
          )}
          {task.description !== "" && <DescriptionIcon />}
          {task.assignees.length > 0 && (
            <span className="ml-auto">
              <AssigneeAvatars assignees={task.assignees} size="xs" />
            </span>
          )}
        </div>
      )}
    </button>
  );
}
