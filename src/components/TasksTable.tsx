"use client";

import { useState } from "react";
import type { TaskAssignee, TaskItem } from "@/lib/clickup";
import { TaskDetailModal } from "./TaskDetailModal";

function formatDueDate(dueDate: number | null): string {
  if (dueDate === null) return "Sem prazo";
  return new Date(dueDate).toLocaleDateString("pt-BR");
}

function AssigneeAvatars({ assignees }: { assignees: TaskAssignee[] }) {
  if (assignees.length === 0) {
    return <span className="text-xs text-muted-foreground">Sem responsável</span>;
  }
  return (
    <div className="flex items-center -space-x-2">
      {assignees.map((a) => (
        <span
          key={a.name}
          title={a.name}
          className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-card"
        >
          {a.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL assinada do ClickUp
            <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white"
              style={{ backgroundColor: a.color }}
            >
              {a.initials}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

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
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]">
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
        <div>
          {section.tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onSelectTask(task)}
              className="flex w-full items-center gap-4 border-t border-border px-4 py-3 text-left transition-colors hover:bg-muted"
            >
              <p className="flex-1 truncate text-sm text-card-foreground">{task.name}</p>
              <p className="hidden w-48 shrink-0 truncate text-xs text-muted-foreground sm:block">
                {task.description || "—"}
              </p>
              <p className="w-24 shrink-0 text-xs text-muted-foreground">{formatDueDate(task.dueDate)}</p>
              <div className="w-20 shrink-0">
                <AssigneeAvatars assignees={task.assignees} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TasksTable({ tasks }: { tasks: TaskItem[] }) {
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
      <div className="flex items-center gap-4 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <p className="flex-1">Nome</p>
        <p className="hidden w-48 shrink-0 sm:block">Descrição</p>
        <p className="w-24 shrink-0">Data prevista</p>
        <p className="w-20 shrink-0">Responsável</p>
      </div>
      {sections.map((section) => (
        <TaskSection key={section.label} section={section} onSelectTask={setSelectedTask} />
      ))}
      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}
