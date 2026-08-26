"use client";

type Priority = "urgent" | "high" | "normal" | "low";

const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgente",
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};
const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "#ef4444",
  high: "#f59e0b",
  normal: "#94a3b8",
  low: "#64748b",
};

export type AdminTask = {
  id: string;
  title: string;
  priority: Priority;
  statusId: string;
  dueAt: string | null;
  tags: { id: string; name: string; color: string }[];
  checklist: { id: string; done: boolean }[];
};

export function TaskCard({ task, onOpen }: { task: AdminTask; onOpen: () => void }) {
  const doneCount = task.checklist.filter((c) => c.done).length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-md border border-border bg-card p-3 text-left shadow-sm hover:border-brand-accent"
    >
      <p className="text-sm font-semibold text-card-foreground">{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: PRIORITY_COLOR[task.priority] }}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.tags.map((t) => (
          <span key={t.id} className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: t.color }}>
            {t.name}
          </span>
        ))}
        {task.checklist.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {doneCount}/{task.checklist.length}
          </span>
        )}
      </div>
    </button>
  );
}
