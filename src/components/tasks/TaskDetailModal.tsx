// src/components/TaskDetailModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientTask, ClientTaskStatus } from "@/components/tasks/types";
import { PRIORITY_LABEL, PRIORITY_COLOR } from "@/components/tasks/types";
import { CommentsIcon, DescriptionIcon } from "@/components/ui/icons";

type Comment = { id: string; body: string; createdAt: string; authorType: "admin" | "client"; authorName: string };

function formatDate(value: string | null): string | null {
  if (value === null) return null;
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (diff < minute) return "agora mesmo";
  if (diff < hour) return `há ${Math.floor(diff / minute)} min`;
  if (diff < day) return `há ${Math.floor(diff / hour)} h`;
  if (diff < day * 30) return `há ${Math.floor(diff / day)} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-card-foreground">
          {icon}
          {label}
        </p>
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

function StatusField({
  statusId,
  statuses,
  clientId,
  taskId,
  onChanged,
}: {
  statusId: string;
  statuses: ClientTaskStatus[];
  clientId: string;
  taskId: string;
  onChanged: (statusId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  const current = statuses.find((s) => s.id === statusId);

  async function handleSelect(next: ClientTaskStatus) {
    if (next.id === statusId) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId: next.id }),
      });
      if (!res.ok) throw new Error();
      onChanged(next.id);
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
          style={{ backgroundColor: current?.color ?? "#94a3b8" }}
        >
          {current?.name ?? "—"}
        </button>
        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
            {statuses.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {s.id === statusId && <span className="shrink-0 text-brand-accent">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}

function CommentBox({
  clientId,
  taskId,
  onPosted,
}: {
  clientId: string;
  taskId: string;
  onPosted: (comment: Comment) => void;
}) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    if (!text.trim() || posting) return;
    setPosting(true);
    setError(false);
    try {
      const res = await fetch(`/api/tasks/${clientId}/task/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) throw new Error();
      const data: { comment: Comment } = await res.json();
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

function CommentsField({ clientId, task }: { clientId: string; task: ClientTask }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setComments(null);
    setFailed(false);
    fetch(`/api/tasks/${clientId}/task/${task.id}/comments`)
      .then((res) => {
        if (!res.ok) throw new Error("fetch_failed");
        return res.json();
      })
      .then((data: { comments: Comment[] }) => {
        if (!cancelled) setComments(data.comments);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, task.id]);

  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-card-foreground">
        <CommentsIcon size={14} />
        Comentários
      </p>

      <CommentBox
        clientId={clientId}
        taskId={task.id}
        onPosted={(comment) => setComments((prev) => (prev ? [comment, ...prev] : [comment]))}
      />

      <ul className="space-y-4">
        {failed && (
          <li>
            <span className="text-sm text-muted-foreground">Não foi possível carregar os comentários.</span>
          </li>
        )}
        {!failed && comments === null && (
          <li>
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </li>
        )}
        {!failed && comments !== null && comments.length === 0 && (
          <li>
            <span className="text-sm text-muted-foreground">Sem comentários ainda.</span>
          </li>
        )}
        {!failed &&
          comments !== null &&
          comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-card-foreground">
                {c.authorName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-card-foreground">
                  <span className="font-bold text-card-foreground">{c.authorName}</span> {c.body}
                </p>
                <span className="text-[11px] text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}

export function TaskDetailModal({
  task,
  statuses,
  clientId,
  onClose,
}: {
  task: ClientTask;
  statuses: ClientTaskStatus[];
  clientId: string;
  onClose: () => void;
}) {
  const [statusId, setStatusId] = useState(task.statusId);

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
          <h2 className="truncate text-sm font-bold text-card-foreground">{task.title}</h2>
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
              <h1 className="mb-6 text-xl font-bold text-card-foreground">{task.title}</h1>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                  <StatusField
                    statusId={statusId}
                    statuses={statuses}
                    clientId={clientId}
                    taskId={task.id}
                    onChanged={setStatusId}
                  />

                  <Field label="Prioridade">
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                      style={{ backgroundColor: PRIORITY_COLOR[task.priority] }}
                    >
                      {PRIORITY_LABEL[task.priority]}
                    </span>
                  </Field>

                  <Field label="Prazo">
                    {formatDate(task.dueAt) ?? <span className="text-muted-foreground">Sem prazo</span>}
                  </Field>
                </div>

                <Field label="Tags">
                  {task.tags.length === 0 ? (
                    <span className="text-muted-foreground">Sem tags</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {task.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </Field>

                <Field label="Checklist">
                  {task.checklist.length === 0 ? (
                    <span className="text-muted-foreground">Sem itens</span>
                  ) : (
                    <ul className="space-y-1.5">
                      {task.checklist.map((item) => (
                        <li key={item.id} className="flex items-center gap-2">
                          <input type="checkbox" checked={item.done} disabled readOnly className="h-3.5 w-3.5 rounded" />
                          <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Field>

                <Field label="Descrição" icon={<DescriptionIcon size={14} />}>
                  {task.description ? (
                    <p className="whitespace-pre-wrap">{task.description}</p>
                  ) : (
                    <span className="text-muted-foreground">Sem descrição</span>
                  )}
                </Field>
              </div>
            </div>
          </div>

          <div className="min-w-0 shrink-0 overflow-y-auto border-l border-border bg-muted/30 md:w-[380px]">
            <div className="p-6">
              <CommentsField clientId={clientId} task={task} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
