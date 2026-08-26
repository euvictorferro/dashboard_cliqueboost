"use client";

import { useEffect, useState } from "react";
import type { AdminTask } from "@/components/admin/tasks/TaskCard";

type ChecklistItem = { id: string; label: string; done: boolean };
type Attachment = { id: string; filename: string; url: string };
type Tag = { id: string; name: string; color: string };

export function TaskAdminModal({
  task,
  statuses,
  allTags,
  onClose,
  onDeleted,
}: {
  task: AdminTask;
  statuses: { id: string; name: string }[];
  allTags: Tag[];
  onClose: () => void;
  onDeleted: (taskId: string) => void;
}) {
  const [statusId, setStatusId] = useState(task.statusId);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist as ChecklistItem[]);
  const [newItem, setNewItem] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    fetch(`/api/admin/tasks/${task.id}/attachments`)
      .then((res) => res.json())
      .then((data: { attachments: Attachment[] }) => setAttachments(data.attachments));
  }, [task.id]);

  async function changeStatus(next: string) {
    setStatusId(next);
    await fetch(`/api/admin/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId: next }),
    });
  }

  async function addItem() {
    if (!newItem.trim()) return;
    const res = await fetch(`/api/admin/tasks/${task.id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newItem.trim() }),
    });
    if (res.ok) {
      const data: { item: ChecklistItem } = await res.json();
      setChecklist((prev) => [...prev, data.item]);
      setNewItem("");
    }
  }

  async function toggleItem(item: ChecklistItem) {
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    await fetch(`/api/admin/tasks/${task.id}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
  }

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/admin/tasks/${task.id}/attachments`, { method: "POST", body: formData });
    if (res.ok) {
      const data: { attachment: Attachment } = await res.json();
      setAttachments((prev) => [data.attachment, ...prev]);
    }
  }

  async function remove() {
    if (!confirm("Apagar essa task?")) return;
    await fetch(`/api/admin/tasks/${task.id}`, { method: "DELETE" });
    onDeleted(task.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-y-auto rounded-md bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-card-foreground">{task.title}</h2>
          <button type="button" onClick={remove} className="text-xs font-semibold text-red-600">Apagar</button>
        </div>

        <label className="mb-1 block text-xs font-bold text-card-foreground">Status</label>
        <select value={statusId} onChange={(e) => changeStatus(e.target.value)} className="mb-4 w-full rounded-md border border-border bg-transparent px-2 py-2 text-sm">
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {allTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {allTags.map((t) => (
              <span key={t.id} className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: t.color }}>
                {t.name}
              </span>
            ))}
          </div>
        )}

        <p className="mb-1 text-xs font-bold text-card-foreground">Checklist</p>
        <ul className="mb-2 space-y-1">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.done} onChange={() => toggleItem(item)} />
              <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
            </li>
          ))}
        </ul>
        <div className="mb-4 flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Novo item"
            className="flex-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
          />
          <button type="button" onClick={addItem} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Adicionar</button>
        </div>

        <p className="mb-1 text-xs font-bold text-card-foreground">Anexos</p>
        <ul className="mb-2 space-y-1">
          {attachments.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-brand-accent underline">{a.filename}</a>
            </li>
          ))}
        </ul>
        <input type="file" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} className="mb-4 text-sm" />

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">Fechar</button>
        </div>
      </div>
    </div>
  );
}
