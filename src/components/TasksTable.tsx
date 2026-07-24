"use client";

import { useState } from "react";
import type { TaskItem } from "@/lib/clickup";
import { TaskCard } from "./TaskCard";
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

type TaskSectionData = { label: string; color: string; order: number; tasks: TaskItem[] };

function TaskSection({ section, onSelectTask }: { section: TaskSectionData; onSelectTask: (task: TaskItem) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-muted/60">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
        <ChevronIcon open={open} />
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: section.color }}
        >
          {section.label}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{section.tasks.length}</span>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {section.tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onSelectTask(task)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TasksTable({
  tasks,
  clientId,
  accessKey,
}: {
  tasks: TaskItem[];
  clientId: string;
  accessKey: string;
}) {
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const groups = new Map<string, TaskSectionData>();
  for (const task of tasks) {
    const existing = groups.get(task.status);
    if (existing) {
      existing.tasks.push(task);
    } else {
      groups.set(task.status, { label: task.status, color: task.statusColor, order: task.statusOrder, tasks: [task] });
    }
  }

  const sections = [...groups.values()].sort((a, b) => a.order - b.order);
  for (const section of sections) {
    section.tasks.sort((a, b) => {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate - b.dueDate;
    });
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <TaskSection key={section.label} section={section} onSelectTask={setSelectedTask} />
      ))}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} clientId={clientId} accessKey={accessKey} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
