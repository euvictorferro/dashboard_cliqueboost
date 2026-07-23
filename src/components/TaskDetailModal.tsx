"use client";

import { useEffect } from "react";
import type { TaskItem } from "@/lib/clickup";

function formatDate(value: number | null): string | null {
  if (value === null) return null;
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function formatDateRange(startDate: number | null, dueDate: number | null): string {
  const start = formatDate(startDate);
  const due = formatDate(dueDate);
  if (start && due) return `${start} → ${due}`;
  if (due) return `Até ${due}`;
  if (start) return `A partir de ${start}`;
  return "Sem prazo definido";
}

function formatTime(timeEstimate: number | null, timeSpent: number): string {
  const parts: string[] = [];
  if (timeEstimate) parts.push(`${formatDuration(timeEstimate)} estimadas`);
  if (timeSpent) parts.push(`${formatDuration(timeSpent)} registradas`);
  return parts.length > 0 ? parts.join(" · ") : "Não definido";
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-card-foreground">{children}</div>
    </div>
  );
}

export function TaskDetailModal({ task, onClose }: { task: TaskItem; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-card-foreground">{task.name}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Status">
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: task.statusColor }}
            >
              {task.status}
            </span>
          </Field>

          <Field label="Responsáveis">
            {task.assignees.length === 0 ? (
              <span className="text-muted-foreground">Sem responsável</span>
            ) : (
              <ul className="space-y-1.5">
                {task.assignees.map((a) => (
                  <li key={a.name} className="flex items-center gap-2">
                    {a.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL assinada do ClickUp
                      <img src={a.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: a.color }}
                      >
                        {a.initials}
                      </span>
                    )}
                    {a.name}
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <Field label="Datas">{formatDateRange(task.startDate, task.dueDate)}</Field>

          <Field label="Prioridade">
            {task.priority ? (
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: task.priority.color }}
              >
                {task.priority.label}
              </span>
            ) : (
              <span className="text-muted-foreground">Sem prioridade</span>
            )}
          </Field>

          <Field label="Tempo">{formatTime(task.timeEstimate, task.timeSpent)}</Field>

          <Field label="Tags">
            {task.tags.length === 0 ? (
              <span className="text-muted-foreground">Sem tags</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-card-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </Field>

          <Field label="Descrição">
            {task.description ? (
              <p className="whitespace-pre-wrap">{task.description}</p>
            ) : (
              <span className="text-muted-foreground">Sem descrição</span>
            )}
          </Field>
        </div>
      </div>
    </div>
  );
}
