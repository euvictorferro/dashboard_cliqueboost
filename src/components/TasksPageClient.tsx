"use client";

import { useEffect, useState } from "react";
import type { TaskItem } from "@/lib/clickup";
import { TasksTable } from "./TasksTable";

type ErrorKind = "no_list" | "fetch_failed";

export function TasksPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [error, setError] = useState<ErrorKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTasks(null);
    setError(null);
    fetch(`/api/tasks/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error === "no_list_configured" ? "no_list" : "fetch_failed");
        }
        return data as { tasks: TaskItem[] };
      })
      .then((data) => {
        if (!cancelled) setTasks(data.tasks);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message === "no_list" ? "no_list" : "fetch_failed");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey]);

  const errorMessage =
    error === "no_list"
      ? "Nenhuma lista de tarefas configurada pra esse cliente."
      : "Não foi possível carregar as tarefas agora.";

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Tasks</h1>
      {error && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          {errorMessage}
        </p>
      )}
      {!error && !tasks && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!error && tasks && <TasksTable tasks={tasks} clientId={clientId} accessKey={accessKey} />}
    </div>
  );
}
