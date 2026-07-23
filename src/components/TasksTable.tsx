import type { TaskItem } from "@/lib/clickup";

function formatDueDate(dueDate: number | null): string {
  if (dueDate === null) return "Sem prazo";
  return new Date(dueDate).toLocaleDateString("pt-BR");
}

function formatAssignees(assignees: string[]): string {
  return assignees.length > 0 ? assignees.join(", ") : "Sem responsável";
}

export function TasksTable({ tasks }: { tasks: TaskItem[] }) {
  const sorted = [...tasks].sort((a, b) => {
    if (a.statusOrder !== b.statusOrder) return a.statusOrder - b.statusOrder;
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate - b.dueDate;
  });

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Data prevista</th>
            <th className="px-4 py-3 font-medium">Responsável</th>
            <th className="px-4 py-3 font-medium">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => (
            <tr key={task.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-card-foreground">{task.name}</td>
              <td className="px-4 py-3">
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: task.statusColor }}
                >
                  {task.status}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{formatDueDate(task.dueDate)}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatAssignees(task.assignees)}</td>
              <td className="px-4 py-3 text-muted-foreground">{task.description || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>
      )}
    </div>
  );
}
