// src/components/tasks/types.ts
export type Priority = "urgent" | "high" | "normal" | "low";
export type ClientTaskTag = { id: string; name: string; color: string };
export type ClientChecklistItem = { id: string; label: string; done: boolean };
export type ClientTask = {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  statusId: string;
  dueAt: string | null;
  tags: ClientTaskTag[];
  checklist: ClientChecklistItem[];
};
export type ClientTaskStatus = { id: string; name: string; color: string };

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgente",
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};
export const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "#ef4444",
  high: "#f59e0b",
  normal: "#94a3b8",
  low: "#64748b",
};
