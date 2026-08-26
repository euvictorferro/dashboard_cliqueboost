"use client";

import { TaskCard, type AdminTask } from "@/components/admin/tasks/TaskCard";

export function TaskKanbanColumn({
  name,
  color,
  tasks,
  onOpenTask,
}: {
  name: string;
  color: string;
  tasks: AdminTask[];
  onOpenTask: (task: AdminTask) => void;
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-md bg-muted/30 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-sm font-bold text-card-foreground">{name}</p>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={() => onOpenTask(t)} />
        ))}
        {tasks.length === 0 && <p className="text-xs text-muted-foreground">Sem tasks</p>}
      </div>
    </div>
  );
}
