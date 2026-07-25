// src/components/TasksTable.tsx
"use client";

import { useState } from "react";
import type { TaskItem, TaskStatus } from "@/lib/clickup";
import { TaskRow } from "./TaskRow";
import { TaskDetailModal } from "./TaskDetailModal";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TaskSection({
  status,
  tasks,
  onSelectTask,
}: {
  status: TaskStatus;
  tasks: TaskItem[];
  onSelectTask: (task: TaskItem) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-muted/60">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
        <ChevronIcon open={open} />
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: status.color }}>
          {status.status}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{tasks.length}</span>
      </button>
      {open && (
        <div className="pb-1">
          <div className="grid grid-cols-[1fr_130px_110px_70px_50px] gap-3 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Nome</span>
            <span>Status</span>
            <span>Data</span>
            <span>Responsável</span>
            <span>Prioridade</span>
          </div>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onClick={() => onSelectTask(task)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TasksTable({
  tasks,
  statuses,
  clientId,
  accessKey,
}: {
  tasks: TaskItem[];
  statuses: TaskStatus[];
  clientId: string;
  accessKey: string;
}) {
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const tasksByStatus = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    const existing = tasksByStatus.get(task.status) ?? [];
    existing.push(task);
    tasksByStatus.set(task.status, existing);
  }
  for (const list of tasksByStatus.values()) {
    list.sort((a, b) => {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate - b.dueDate;
    });
  }

  if (statuses.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhum status configurado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {statuses.map((status) => (
        <TaskSection
          key={status.status}
          status={status}
          tasks={tasksByStatus.get(status.status) ?? []}
          onSelectTask={setSelectedTask}
        />
      ))}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
