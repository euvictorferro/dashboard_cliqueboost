// src/components/TasksPageClient.tsx
"use client";

import { useEffect, useState } from "react";
import type { TaskItem, TaskStatus } from "@/lib/clickup";
import { TasksTable } from "./TasksTable";

type ErrorKind = "no_list" | "fetch_failed";

export function TasksPageClient({ clientId }: { clientId: string;  }) {
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [error, setError] = useState<ErrorKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTasks(null);
    setStatuses([]);
    setError(null);
    fetch(`/api/tasks/${clientId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error === "no_list_configured" ? "no_list" : "fetch_failed");
        }
        return data as { tasks: TaskItem[]; statuses: TaskStatus[] };
      })
      .then((data) => {
        if (!cancelled) {
          setTasks(data.tasks);
          setStatuses(data.statuses);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message === "no_list" ? "no_list" : "fetch_failed");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const errorMessage =
    error === "no_list"
      ? "Nenhuma lista de tarefas configurada pra esse cliente."
      : "Não foi possível carregar as tarefas agora.";

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 pt-6 pb-10 sm:px-10">
      {error && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          {errorMessage}
        </p>
      )}
      {!error && !tasks && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!error && tasks && <TasksTable tasks={tasks} statuses={statuses} clientId={clientId} />}
    </div>
  );
}
