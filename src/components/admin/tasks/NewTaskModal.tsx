"use client";

import { useState } from "react";
import type { AdminTask } from "@/components/admin/tasks/TaskCard";

export function NewTaskModal({
  clientId,
  statuses,
  onClose,
  onCreated,
}: {
  clientId: string;
  statuses: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (task: AdminTask) => void;
}) {
  const [title, setTitle] = useState("");
  const [statusId, setStatusId] = useState(statuses[0]?.id ?? "");
  const [priority, setPriority] = useState<"urgent" | "high" | "normal" | "low">("normal");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, statusId, title: title.trim(), priority }),
      });
      if (!res.ok) throw new Error();
      const data: { task: AdminTask } = await res.json();
      onCreated(data.task);
      onClose();
    } catch {
      console.error("falha ao criar task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-md bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-sm font-bold text-card-foreground">Nova task</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          autoFocus
          className="mb-3 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
        <div className="mb-4 flex gap-2">
          <select value={statusId} onChange={(e) => setStatusId(e.target.value)} className="flex-1 rounded-md border border-border bg-transparent px-2 py-2 text-sm">
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="flex-1 rounded-md border border-border bg-transparent px-2 py-2 text-sm">
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
            <option value="low">Baixa</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">Cancelar</button>
          <button type="button" onClick={submit} disabled={!title.trim() || saving} className="rounded-md bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {saving ? "Criando..." : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
