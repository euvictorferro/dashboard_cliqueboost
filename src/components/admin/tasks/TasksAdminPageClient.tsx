"use client";

import { useEffect, useState } from "react";
import { TaskKanbanColumn } from "@/components/admin/tasks/TaskKanbanColumn";
import { NewTaskModal } from "@/components/admin/tasks/NewTaskModal";
import { TaskAdminModal } from "@/components/admin/tasks/TaskAdminModal";
import type { AdminTask } from "@/components/admin/tasks/TaskCard";

type Status = { id: string; name: string; color: string; position: number };
type ClientOption = { id: string; name: string; isTest: boolean };
type Tag = { id: string; name: string; color: string };

export function TasksAdminPageClient() {
  const [clients, setClients] = useState<ClientOption[] | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [tasks, setTasks] = useState<AdminTask[] | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [openTask, setOpenTask] = useState<AdminTask | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/admin/clients")
      .then((res) => res.json())
      .then((data: { clients: { id: string; name: string; isTest?: boolean }[] }) => {
        const opts = data.clients.map((c) => ({ id: c.id, name: c.name, isTest: Boolean(c.isTest) }));
        setClients(opts);
        if (opts.length > 0) setSelectedClient((prev) => prev ?? opts[0].id);
      });
    fetch("/api/admin/task-statuses")
      .then((res) => res.json())
      .then((data: { statuses: Status[] }) => setStatuses(data.statuses));
    fetch("/api/admin/task-tags")
      .then((res) => res.json())
      .then((data: { tags: Tag[] }) => setAllTags(data.tags));
  }, []);

  function refetchTasks() {
    if (!selectedClient) return;
    fetch(`/api/admin/tasks?client=${selectedClient}`)
      .then((res) => res.json())
      .then((data: { tasks: AdminTask[] }) => setTasks(data.tasks));
  }

  useEffect(() => {
    if (!selectedClient) return;
    setTasks(null);
    refetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <select
          value={selectedClient ?? ""}
          onChange={(e) => setSelectedClient(e.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        >
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.isTest ? " (teste)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={!selectedClient}
          className="rounded-md bg-brand-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          + Nova task
        </button>
      </div>

      {!tasks && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {tasks && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map((s) => (
            <TaskKanbanColumn
              key={s.id}
              name={s.name}
              color={s.color}
              tasks={tasks.filter((t) => t.statusId === s.id)}
              onOpenTask={(t) => setOpenTask(t)}
            />
          ))}
        </div>
      )}

      {creating && selectedClient && (
        <NewTaskModal
          clientId={selectedClient}
          statuses={statuses}
          onClose={() => setCreating(false)}
          onCreated={() => refetchTasks()}
        />
      )}

      {openTask && (
        <TaskAdminModal
          task={openTask}
          statuses={statuses}
          allTags={allTags}
          onClose={() => setOpenTask(null)}
          onDeleted={() => {
            setOpenTask(null);
            refetchTasks();
          }}
        />
      )}
    </div>
  );
}
