// src/components/TaskDetailModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { TaskComment, TaskItem, TaskListMember, TaskStatus } from "@/lib/clickup";
import { AssigneeAvatars } from "./AssigneeAvatars";

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

function formatTime(timeEstimate: number | null, timeSpent: number): string {
  const parts: string[] = [];
  if (timeEstimate) parts.push(`${formatDuration(timeEstimate)} estimadas`);
  if (timeSpent) parts.push(`${formatDuration(timeSpent)} registradas`);
  return parts.length > 0 ? parts.join(" · ") : "Não definido";
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (diff < minute) return "agora mesmo";
  if (diff < hour) return `há ${Math.floor(diff / minute)} min`;
  if (diff < day) return `há ${Math.floor(diff / hour)} h`;
  if (diff < day * 30) return `há ${Math.floor(diff / day)} d`;
  return new Date(ts).toLocaleDateString("pt-BR");
}

function dateToInputValue(value: number | null): string {
  if (value === null) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Field({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-card-foreground">{label}</p>
        {action}
      </div>
      <div className="text-sm text-card-foreground">{children}</div>
    </div>
  );
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onOutside]);
  return ref;
}

function PlusButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Editar"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-brand-accent hover:text-brand-accent"
    >
      +
    </button>
  );
}

function StatusField({
  status,
  statusColor,
  clientId,
  accessKey,
  taskId,
  onChanged,
}: {
  status: string;
  statusColor: string;
  clientId: string;
  accessKey: string;
  taskId: string;
  onChanged: (status: string, color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<TaskStatus[] | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  useEffect(() => {
    if (!open || statuses !== null) return;
    fetch(`/api/tasks/${clientId}/list-meta?key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      .then((data: { statuses: TaskStatus[] }) => setStatuses(data.statuses ?? []))
      .catch(() => setStatuses([]));
  }, [open, statuses, clientId, accessKey]);

  async function handleSelect(next: TaskStatus) {
    if (next.status === status) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/status?key=${encodeURIComponent(accessKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next.status }),
      });
      if (!res.ok) throw new Error();
      onChanged(next.status, next.color);
    } catch (err) {
      console.error("falha ao trocar status da task", err);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <Field label="Status">
      <div ref={ref} className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={saving}
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: statusColor }}
        >
          {status}
        </button>
        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
            {statuses === null && <p className="px-2 py-1.5 text-xs text-muted-foreground">Carregando...</p>}
            {statuses?.map((s) => (
              <button
                key={s.status}
                type="button"
                onClick={() => handleSelect(s)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="min-w-0 flex-1 truncate">{s.status}</span>
                {s.status === status && <span className="shrink-0 text-brand-accent">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}

function AssigneesField({
  assignees,
  clientId,
  accessKey,
  taskId,
  onToggle,
}: {
  assignees: TaskItem["assignees"];
  clientId: string;
  accessKey: string;
  taskId: string;
  onToggle: (member: TaskListMember, adding: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<TaskListMember[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useClickOutside(() => setOpen(false));

  useEffect(() => {
    if (!open || members !== null) return;
    fetch(`/api/tasks/${clientId}/list-meta?key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      .then((data: { members: TaskListMember[] }) => setMembers(data.members ?? []))
      .catch(() => setMembers([]));
  }, [open, members, clientId, accessKey]);

  async function handleToggle(member: TaskListMember) {
    const isAssigned = assignees.some((a) => a.id === member.id);
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/assignees?key=${encodeURIComponent(accessKey)}`, {
        method: isAssigned ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      if (!res.ok) throw new Error();
      onToggle(member, !isAssigned);
    } catch (err) {
      console.error("falha ao atualizar responsável da task", err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Field
      label="Responsáveis"
      action={
        <div ref={ref} className="relative">
          <PlusButton onClick={() => setOpen((o) => !o)} />
          {open && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
              {members === null && <p className="px-2 py-1.5 text-xs text-muted-foreground">Carregando...</p>}
              {members?.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Sem membros na lista.</p>}
              {members?.map((member) => {
                const isAssigned = assignees.some((a) => a.id === member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleToggle(member)}
                    disabled={busyId === member.id}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${isAssigned ? "bg-muted/70" : ""} disabled:opacity-50`}
                  >
                    {member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL externa do ClickUp
                      <img src={member.avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.initials}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{member.name}</span>
                    {isAssigned && <span className="shrink-0 text-brand-accent">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      }
    >
      {assignees.length === 0 ? (
        <span className="text-muted-foreground">Sem responsável</span>
      ) : (
        <AssigneeAvatars assignees={assignees} size="sm" />
      )}
    </Field>
  );
}

function DueDateField({
  dueDate,
  clientId,
  accessKey,
  taskId,
  onSaved,
}: {
  dueDate: number | null;
  clientId: string;
  accessKey: string;
  taskId: string;
  onSaved: (dueDate: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(dateToInputValue(dueDate));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    const next = draft ? new Date(`${draft}T00:00:00`).getTime() : null;
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/due-date?key=${encodeURIComponent(accessKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: next }),
      });
      if (!res.ok) throw new Error();
      onSaved(next);
      setEditing(false);
    } catch (err) {
      console.error("falha ao editar data da task", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Field
      label="Data prevista"
      action={
        !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(dateToInputValue(dueDate));
              setEditing(true);
            }}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
          >
            Editar
          </button>
        )
      }
    >
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-brand-accent"
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      ) : (
        formatDate(dueDate) ?? <span className="text-muted-foreground">Sem prazo</span>
      )}
    </Field>
  );
}

function DescriptionField({
  text,
  clientId,
  accessKey,
  taskId,
  onSaved,
}: {
  text: string;
  clientId: string;
  accessKey: string;
  taskId: string;
  onSaved: (desc: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/description?key=${encodeURIComponent(accessKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desc: draft }),
      });
      if (!res.ok) throw new Error();
      onSaved(draft);
      setEditing(false);
    } catch (err) {
      console.error("falha ao editar descrição da task", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Field
      label="Descrição"
      action={
        !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(text);
              setEditing(true);
            }}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
          >
            Editar
          </button>
        )
      }
    >
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            autoFocus
            className="w-full resize-y rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : text ? (
        <p className="whitespace-pre-wrap">{text}</p>
      ) : (
        <span className="text-muted-foreground">Sem descrição</span>
      )}
    </Field>
  );
}

function CommentBox({
  clientId,
  accessKey,
  taskId,
  onPosted,
}: {
  clientId: string;
  accessKey: string;
  taskId: string;
  onPosted: (comment: TaskComment) => void;
}) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    if (!text.trim() || posting) return;
    setPosting(true);
    setError(false);
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/comments?key=${encodeURIComponent(accessKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) throw new Error();
      const data: { comment: TaskComment } = await res.json();
      onPosted(data.comment);
      setText("");
    } catch {
      setError(true);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mb-5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escreva um comentário..."
        rows={2}
        className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm text-card-foreground outline-none focus:border-brand-accent"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {error ? <span className="text-xs text-red-600">Falha ao enviar o comentário.</span> : <span />}
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || posting}
          className="shrink-0 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {posting ? "Enviando..." : "Comentar"}
        </button>
      </div>
    </div>
  );
}

function CommentsField({ clientId, accessKey, taskId }: { clientId: string; accessKey: string; taskId: string }) {
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setComments(null);
    setFailed(false);
    fetch(`/api/tasks/${clientId}/task/${taskId}/comments?key=${encodeURIComponent(accessKey)}`)
      .then((res) => {
        if (!res.ok) throw new Error("fetch_failed");
        return res.json();
      })
      .then((data: { comments: TaskComment[] }) => {
        if (!cancelled) setComments(data.comments);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey, taskId]);

  return (
    <div>
      <p className="mb-3 text-sm font-bold text-card-foreground">Comentários</p>

      <CommentBox
        clientId={clientId}
        accessKey={accessKey}
        taskId={taskId}
        onPosted={(comment) => setComments((prev) => (prev ? [comment, ...prev] : [comment]))}
      />

      {failed && <span className="text-sm text-muted-foreground">Não foi possível carregar.</span>}
      {!failed && comments === null && <span className="text-sm text-muted-foreground">Carregando...</span>}
      {!failed && comments !== null && comments.length === 0 && (
        <span className="text-sm text-muted-foreground">Sem comentários.</span>
      )}
      {!failed && comments !== null && comments.length > 0 && (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              {c.authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL externa do ClickUp
                <img src={c.authorAvatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: c.authorColor }}
                >
                  {c.authorInitials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-card-foreground">
                  <span className="font-bold text-card-foreground">{c.authorName}</span> {c.text}
                </p>
                <span className="text-[11px] text-muted-foreground">{formatRelativeTime(c.date)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TaskDetailModal({
  task,
  clientId,
  accessKey,
  onClose,
}: {
  task: TaskItem;
  clientId: string;
  accessKey: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState(task.status);
  const [statusColor, setStatusColor] = useState(task.statusColor);
  const [assignees, setAssignees] = useState(task.assignees);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [description, setDescription] = useState(task.description);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function toggleAssigneeLocal(member: TaskListMember, adding: boolean) {
    setAssignees((prev) =>
      adding
        ? [
            ...prev,
            { id: member.id, name: member.name, color: member.color, initials: member.initials, avatarUrl: member.avatarUrl },
          ]
        : prev.filter((a) => a.id !== member.id),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
          <h2 className="truncate text-sm font-bold text-card-foreground">{task.name}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="p-7">
              <h1 className="mb-6 text-xl font-bold text-card-foreground">{task.name}</h1>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                  <StatusField
                    status={status}
                    statusColor={statusColor}
                    clientId={clientId}
                    accessKey={accessKey}
                    taskId={task.id}
                    onChanged={(s, c) => {
                      setStatus(s);
                      setStatusColor(c);
                    }}
                  />

                  <AssigneesField
                    assignees={assignees}
                    clientId={clientId}
                    accessKey={accessKey}
                    taskId={task.id}
                    onToggle={toggleAssigneeLocal}
                  />

                  <DueDateField
                    dueDate={dueDate}
                    clientId={clientId}
                    accessKey={accessKey}
                    taskId={task.id}
                    onSaved={setDueDate}
                  />

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

                  {task.startDate !== null && <Field label="Início">{formatDate(task.startDate)}</Field>}

                  <Field label="Tempo">{formatTime(task.timeEstimate, task.timeSpent)}</Field>
                </div>

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

                <DescriptionField
                  text={description}
                  clientId={clientId}
                  accessKey={accessKey}
                  taskId={task.id}
                  onSaved={setDescription}
                />
              </div>
            </div>
          </div>

          <div className="min-w-0 shrink-0 overflow-y-auto border-l border-border bg-muted/30 md:w-[380px]">
            <div className="p-6">
              <CommentsField clientId={clientId} accessKey={accessKey} taskId={task.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
