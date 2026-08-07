// src/components/ContentCardModal.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  ContentActivity,
  ContentAssignee,
  ContentAttachment,
  ContentBoardLabel,
  ContentBoardMember,
  ContentCard,
  ContentChecklist,
  ContentChecklistItem,
  ContentLabel,
} from "@/lib/trello";
import { renderMarkdown } from "@/components/ui/markdown";
import { AssigneeAvatars } from "@/components/ui/AssigneeAvatars";
import { AttachmentIcon, ChecklistIcon, CommentsIcon, DescriptionIcon, DownloadIcon, LinkIcon, TrashIcon } from "@/components/ui/icons";
import { VideoUploadField } from "@/components/conteudos/ContentCardVideoField";

type LightboxTarget = { name: string; imageUrl: string; downloadUrl: string };

function formatDueDate(dueDate: number | null): string {
  if (dueDate === null) return "Sem prazo";
  return new Date(dueDate).toLocaleDateString("pt-BR");
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

function coverProxyUrl(clientId: string, url: string): string {
  return `/api/content/${clientId}/cover-proxy?url=${encodeURIComponent(url)}`;
}

function checklistBarColor(percent: number): string {
  if (percent === 100) return "bg-green-500";
  if (percent >= 50) return "bg-blue-500";
  if (percent > 0) return "bg-amber-400";
  return "bg-neutral-300";
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckboxIcon({ checked }: { checked: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0">
      <rect
        x="1"
        y="1"
        width="12"
        height="12"
        rx="2"
        style={checked ? { fill: "hsl(var(--brand-accent))" } : { fill: "none" }}
        stroke="currentColor"
        strokeWidth="1.2"
      />
      {checked && (
        <path d="M3.5 7l2 2 4.5-4.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function Field({
  label,
  icon,
  action,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-card-foreground">
          {icon}
          {label}
        </p>
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
      aria-label="Adicionar"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-brand-accent hover:text-brand-accent"
    >
      +
    </button>
  );
}

function MembersField({
  assignees,
  clientId,
  cardId,
  onToggle,
}: {
  assignees: ContentAssignee[];
  clientId: string;
  cardId: string;
  onToggle: (member: ContentBoardMember, adding: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [boardMembers, setBoardMembers] = useState<ContentBoardMember[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useClickOutside(() => setOpen(false));

  useEffect(() => {
    if (!open || boardMembers !== null) return;
    fetch(`/api/content/${clientId}/board-meta`)
      .then((res) => res.json())
      .then((data: { members: ContentBoardMember[] }) => setBoardMembers(data.members ?? []))
      .catch(() => setBoardMembers([]));
  }, [open, boardMembers, clientId]);

  async function handleToggle(member: ContentBoardMember) {
    const isAssigned = assignees.some((a) => a.id === member.id);
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/content/${clientId}/card/${cardId}/members`, {
        method: isAssigned ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      if (!res.ok) throw new Error();
      onToggle(member, !isAssigned);
    } catch (err) {
      console.error("falha ao atualizar membro do card", err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Field
      label="Membros"
      action={
        <div ref={ref} className="relative">
          <PlusButton onClick={() => setOpen((o) => !o)} />
          {open && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
              {boardMembers === null && <p className="px-2 py-1.5 text-xs text-muted-foreground">Carregando...</p>}
              {boardMembers?.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Sem membros no board.</p>}
              {boardMembers?.map((member) => {
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
                      // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL externa do Trello
                      <img src={member.avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold">
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

function LabelsField({
  labels,
  clientId,
  cardId,
  onToggle,
}: {
  labels: ContentLabel[];
  clientId: string;
  cardId: string;
  onToggle: (label: ContentBoardLabel, adding: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [boardLabels, setBoardLabels] = useState<ContentBoardLabel[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useClickOutside(() => setOpen(false));

  useEffect(() => {
    if (!open || boardLabels !== null) return;
    fetch(`/api/content/${clientId}/board-meta`)
      .then((res) => res.json())
      .then((data: { labels: ContentBoardLabel[] }) => setBoardLabels(data.labels ?? []))
      .catch(() => setBoardLabels([]));
  }, [open, boardLabels, clientId]);

  async function handleToggle(label: ContentBoardLabel) {
    const isApplied = labels.some((l) => l.id === label.id);
    setBusyId(label.id);
    try {
      const res = await fetch(`/api/content/${clientId}/card/${cardId}/labels`, {
        method: isApplied ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId: label.id }),
      });
      if (!res.ok) throw new Error();
      onToggle(label, !isApplied);
    } catch (err) {
      console.error("falha ao atualizar label do card", err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Field
      label="Labels"
      action={
        <div ref={ref} className="relative">
          <PlusButton onClick={() => setOpen((o) => !o)} />
          {open && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
              {boardLabels === null && <p className="px-2 py-1.5 text-xs text-muted-foreground">Carregando...</p>}
              {boardLabels?.filter((l) => l.name).length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Sem labels no board.</p>
              )}
              {boardLabels
                ?.filter((l) => l.name)
                .map((label) => {
                  const isApplied = labels.some((l) => l.id === label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => handleToggle(label)}
                      disabled={busyId === label.id}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50"
                    >
                      <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: label.color }} />
                      <span className="min-w-0 flex-1 truncate">{label.name}</span>
                      {isApplied && <span className="shrink-0 text-brand-accent">✓</span>}
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      }
    >
      {labels.length === 0 ? (
        <span className="text-muted-foreground">Sem labels</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <span
              key={label.id}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
    </Field>
  );
}

function DescriptionField({
  text,
  clientId,
  cardId,
  onSaved,
}: {
  text: string;
  clientId: string;
  cardId: string;
  onSaved: (desc: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  const isLong = text.length > 360;
  const collapsed = isLong && !expanded;

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content/${clientId}/card/${cardId}/description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desc: draft }),
      });
      if (!res.ok) throw new Error();
      onSaved(draft);
      setEditing(false);
    } catch (err) {
      console.error("falha ao editar descrição", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Field
      label="Descrição"
      icon={<DescriptionIcon size={14} />}
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
            rows={10}
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
        <div>
          <div className={`relative ${collapsed ? "max-h-40 overflow-hidden" : ""}`}>
            {renderMarkdown(text)}
            {collapsed && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card to-transparent" />
            )}
          </div>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-2 w-full rounded-md bg-muted py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/70"
            >
              {expanded ? "Mostrar menos" : "Mostrar mais"}
            </button>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground">Sem descrição</span>
      )}
    </Field>
  );
}

function ChecklistField({
  checklist,
  onToggle,
  onAddItem,
  onDeleteItem,
}: {
  checklist: ContentChecklist;
  onToggle: (item: ContentChecklistItem) => void;
  onAddItem: (name: string) => Promise<void>;
  onDeleteItem: (item: ContentChecklistItem) => void;
}) {
  const [newItemName, setNewItemName] = useState("");
  const [adding, setAdding] = useState(false);
  const percent = checklist.total === 0 ? 0 : Math.round((checklist.checked / checklist.total) * 100);

  async function submitNewItem() {
    if (!newItemName.trim() || adding) return;
    setAdding(true);
    try {
      await onAddItem(newItemName.trim());
      setNewItemName("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Field label={`Checklist (${checklist.checked}/${checklist.total})`} icon={<ChecklistIcon size={14} />}>
      <div className="mb-3 flex items-center gap-2">
        <span className="w-9 shrink-0 text-xs font-semibold text-muted-foreground">{percent}%</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full transition-all ${checklistBarColor(percent)}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
      <ul className="space-y-1.5">
        {checklist.items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2">
            <button type="button" onClick={() => onToggle(item)} className="shrink-0">
              <CheckboxIcon checked={item.checked} />
            </button>
            <span className={`flex-1 ${item.checked ? "text-muted-foreground line-through" : ""}`}>{item.name}</span>
            <button
              type="button"
              onClick={() => onDeleteItem(item)}
              aria-label="Remover item"
              className="shrink-0 text-muted-foreground opacity-0 hover:text-red-500 group-hover:opacity-100"
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitNewItem()}
          placeholder="Adicionar item"
          className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-brand-accent"
        />
        <button
          type="button"
          onClick={submitNewItem}
          disabled={adding || !newItemName.trim()}
          className="shrink-0 rounded-md bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/70 disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>
    </Field>
  );
}

function LinkRow({ attachment }: { attachment: ContentAttachment }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  let domain = "";
  try {
    domain = new URL(attachment.url).hostname;
  } catch {
    // ponytail: url inválida (raro) — cai no ícone genérico
  }

  return (
    <li className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
      {domain && !faviconFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- favicon de serviço externo (Google), não asset local
        <img
          src={`https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`}
          alt=""
          className="h-4 w-4 shrink-0 rounded-sm"
          onError={() => setFaviconFailed(true)}
        />
      ) : (
        <LinkIcon />
      )}
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate text-brand-accent hover:underline"
      >
        {attachment.name}
      </a>
      <span className="shrink-0 text-[10px] text-muted-foreground">{formatRelativeTime(attachment.date)}</span>
    </li>
  );
}

function FileRow({
  attachment,
  clientId,
  onOpenImage,
}: {
  attachment: ContentAttachment;
  clientId: string;
  onOpenImage: (target: LightboxTarget) => void;
}) {
  const canPreview = attachment.previewUrl !== null;

  function open() {
    onOpenImage({
      name: attachment.name,
      imageUrl: attachment.largePreviewUrl ?? attachment.previewUrl!,
      downloadUrl: attachment.url,
    });
  }

  return (
    <li className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2">
      {canPreview ? (
        <button type="button" onClick={open} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem vem do proxy autenticado */}
          <img
            src={coverProxyUrl(clientId, attachment.previewUrl!)}
            alt=""
            className="h-10 w-10 rounded object-cover"
          />
        </button>
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
          <AttachmentIcon size={14} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {canPreview ? (
          <button type="button" onClick={open} className="block max-w-full truncate text-left text-brand-accent hover:underline">
            {attachment.name}
          </button>
        ) : (
          <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block truncate text-brand-accent hover:underline">
            {attachment.name}
          </a>
        )}
        <p className="text-[10px] text-muted-foreground">Adicionado {formatRelativeTime(attachment.date)}</p>
      </div>
    </li>
  );
}

function AttachmentsField({
  attachments,
  clientId,
  onOpenImage,
  onAddLink,
  onAddFile,
}: {
  attachments: ContentAttachment[];
  clientId: string;
  onOpenImage: (target: LightboxTarget) => void;
  onAddLink: (url: string) => Promise<void>;
  onAddFile: (file: File) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const links = attachments.filter((a) => !a.isUpload);
  const files = attachments.filter((a) => a.isUpload);

  async function submit() {
    if (!url.trim() || saving) return;
    setSaving(true);
    setError(false);
    try {
      await onAddLink(url.trim());
      setUrl("");
      setAdding(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(false);
    try {
      await onAddFile(file);
      setAdding(false);
    } catch {
      setError(true);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Field
      label="Anexos"
      icon={<AttachmentIcon size={14} />}
      action={
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
        >
          Adicionar
        </button>
      }
    >
      {adding && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Cole um link..."
              autoFocus
              className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-brand-accent"
            />
            <button
              type="button"
              onClick={submit}
              disabled={saving || !url.trim()}
              className="shrink-0 rounded-md bg-brand-accent px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ou</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              {uploading ? "Enviando..." : "Escolher arquivo"}
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
          </div>
        </div>
      )}
      {error && <p className="mb-2 text-xs text-red-500">Não foi possível anexar.</p>}
      {links.length === 0 && files.length === 0 ? (
        <span className="text-muted-foreground">Sem anexos</span>
      ) : (
        <div className="space-y-4">
          {links.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Links</p>
              <ul className="space-y-2">
                {links.map((a) => (
                  <LinkRow key={a.url} attachment={a} />
                ))}
              </ul>
            </div>
          )}
          {files.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Arquivos</p>
              <ul className="space-y-2">
                {files.map((a) => (
                  <FileRow key={a.url} attachment={a} clientId={clientId} onOpenImage={onOpenImage} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Field>
  );
}

function InlineLink({ url }: { url: string }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    // ponytail: url mal formada dentro de texto livre — mostra sem favicon
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 break-all text-blue-600 underline"
    >
      {domain && !faviconFailed && (
        // eslint-disable-next-line @next/next/no-img-element -- favicon de serviço externo (Google), não asset local
        <img
          src={`https://www.google.com/s2/favicons?sz=16&domain=${encodeURIComponent(domain)}`}
          alt=""
          className="h-3 w-3 shrink-0"
          onError={() => setFaviconFailed(true)}
        />
      )}
      {url}
    </a>
  );
}

function renderCommentText(text: string): ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => (i % 2 === 1 ? <InlineLink key={i} url={part} /> : part ? <span key={i}>{part}</span> : null));
}

function CommentBox({
  clientId,
  cardId,
  onPosted,
}: {
  clientId: string;
  cardId: string;
  onPosted: (activity: ContentActivity) => void;
}) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    if (!text.trim() || posting) return;
    setPosting(true);
    setError(false);
    try {
      const res = await fetch(`/api/content/${clientId}/card/${cardId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) throw new Error();
      const data: { activity: ContentActivity } = await res.json();
      onPosted(data.activity);
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

function ActivityField({
  clientId,
  cardId,
  onOpenImage,
}: {
  clientId: string;
  cardId: string;
  onOpenImage: (target: LightboxTarget) => void;
}) {
  const [activity, setActivity] = useState<ContentActivity[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setActivity(null);
    setFailed(false);
    setShowDetails(false);
    fetch(`/api/content/${clientId}/card/${cardId}/activity`)
      .then((res) => {
        if (!res.ok) throw new Error("fetch_failed");
        return res.json();
      })
      .then((data: { activity: ContentActivity[] }) => {
        if (!cancelled) setActivity(data.activity);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, cardId]);

  function openAttachmentRef(ref: NonNullable<ContentActivity["attachmentRef"]>) {
    if (ref.previewUrl) {
      onOpenImage({ name: ref.name, imageUrl: ref.previewUrl, downloadUrl: ref.url });
    } else {
      window.open(coverProxyUrl(clientId, ref.url), "_blank", "noopener,noreferrer");
    }
  }

  const creationOnly = activity?.filter((a) => a.isCreation) ?? [];
  const collapsedView = creationOnly.length > 0 ? creationOnly : (activity?.slice(-1) ?? []);
  const visible = showDetails ? (activity ?? []) : collapsedView;

  return (
    <div>
      <div className="mb-3 flex flex-nowrap items-center justify-between gap-3">
        <p className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-bold text-card-foreground">
          <CommentsIcon size={14} />
          Comentários e atividade
        </p>
        {activity !== null && activity.length > 1 && (
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            {showDetails ? "Fechar Detalhes" : "Mostrar Detalhes"}
          </button>
        )}
      </div>

      <CommentBox
        clientId={clientId}
        cardId={cardId}
        onPosted={(newActivity) => {
          setActivity((prev) => (prev ? [newActivity, ...prev] : [newActivity]));
          setShowDetails(true);
        }}
      />

      {failed && <span className="text-sm text-muted-foreground">Não foi possível carregar.</span>}
      {!failed && activity === null && <span className="text-sm text-muted-foreground">Carregando...</span>}
      {!failed && activity !== null && activity.length === 0 && (
        <span className="text-sm text-muted-foreground">Sem comentários ou atividade.</span>
      )}
      {!failed && activity !== null && activity.length > 0 && (
        <ul className="space-y-4">
          {visible.map((a) => (
            <li key={a.id} className="flex items-start gap-2.5">
              {a.authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL externa do Trello
                <img src={a.authorAvatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {a.authorInitials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-card-foreground">
                  <span className="font-bold text-card-foreground">{a.authorName}</span>{" "}
                  {a.kind === "comment" ? renderCommentText(a.text) : a.text}
                  {a.attachmentRef && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => openAttachmentRef(a.attachmentRef!)}
                        className="text-blue-600 underline"
                      >
                        {a.attachmentRef.name}
                      </button>
                    </>
                  )}
                  {a.textAfter && <> {a.textAfter}</>}
                </p>
                <span className="text-[11px] font-medium text-blue-600 underline underline-offset-2">
                  {formatRelativeTime(a.date)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ImageLightbox({
  target,
  clientId,
  onClose,
}: {
  target: LightboxTarget;
  clientId: string;
  onClose: () => void;
}) {
  const src = coverProxyUrl(clientId, target.imageUrl);
  const downloadSrc = coverProxyUrl(clientId, target.downloadUrl);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-6"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        <div className="absolute -top-11 right-0 flex items-center gap-2">
          <a
            href={downloadSrc}
            download={target.name}
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
          >
            <DownloadIcon />
            Download
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <CloseIcon />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem vem do proxy autenticado */}
        <img src={src} alt={target.name} className="max-h-[80vh] max-w-full rounded object-contain" />
      </div>
    </div>
  );
}

export function ContentCardModal({
  card,
  clientId,
  onClose,
}: {
  card: ContentCard;
  clientId: string;
  onClose: () => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lightboxTarget, setLightboxTarget] = useState<LightboxTarget | null>(null);
  const [checklist, setChecklist] = useState(card.checklist);
  const [attachments, setAttachments] = useState(card.attachments);
  const [description, setDescription] = useState(card.description);
  const [labels, setLabels] = useState(card.labels);
  const [assignees, setAssignees] = useState(card.assignees);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const showCover = card.coverImageUrl !== null && !coverFailed;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !lightboxTarget) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, lightboxTarget]);

  useEffect(() => {
    const el = leftScrollRef.current;
    if (!el) return;
    function onScroll() {
      setScrolled(el!.scrollTop > 24);
    }
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function toggleChecklistItem(item: ContentChecklistItem) {
    const nextChecked = !item.checked;
    setChecklist((prev) =>
      prev
        ? {
            ...prev,
            checked: prev.checked + (nextChecked ? 1 : -1),
            items: prev.items.map((i) => (i.id === item.id ? { ...i, checked: nextChecked } : i)),
          }
        : prev,
    );
    try {
      const res = await fetch(`/api/content/${clientId}/card/${card.id}/checklist/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkItemId: item.id, checked: nextChecked }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setChecklist((prev) =>
        prev
          ? {
              ...prev,
              checked: prev.checked + (nextChecked ? -1 : 1),
              items: prev.items.map((i) => (i.id === item.id ? { ...i, checked: item.checked } : i)),
            }
          : prev,
      );
    }
  }

  async function addChecklistItemLocal(name: string) {
    const checklistId = checklist?.items[0]?.checklistId;
    if (!checklistId) return;
    const res = await fetch(`/api/content/${clientId}/card/${card.id}/checklist/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklistId, name }),
    });
    if (!res.ok) throw new Error();
    const data: { item: ContentChecklistItem } = await res.json();
    setChecklist((prev) => (prev ? { ...prev, total: prev.total + 1, items: [...prev.items, data.item] } : prev));
  }

  async function deleteChecklistItemLocal(item: ContentChecklistItem) {
    setChecklist((prev) =>
      prev
        ? {
            ...prev,
            total: prev.total - 1,
            checked: prev.checked - (item.checked ? 1 : 0),
            items: prev.items.filter((i) => i.id !== item.id),
          }
        : prev,
    );
    try {
      const res = await fetch(`/api/content/${clientId}/card/${card.id}/checklist/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistId: item.checklistId, checkItemId: item.id }),
      });
      if (!res.ok) throw new Error();
    } catch (err) {
      console.error("falha ao remover item da checklist", err);
    }
  }

  async function addLinkAttachmentLocal(url: string) {
    const res = await fetch(`/api/content/${clientId}/card/${card.id}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error();
    const data: { attachment: ContentAttachment } = await res.json();
    setAttachments((prev) => [...prev, data.attachment]);
  }

  async function addFileAttachmentLocal(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(
      `/api/content/${clientId}/card/${card.id}/attachments/upload`,
      { method: "POST", body: formData },
    );
    if (!res.ok) throw new Error();
    const data: { attachment: ContentAttachment } = await res.json();
    setAttachments((prev) => [...prev, data.attachment]);
  }

  function toggleLabelLocal(label: ContentBoardLabel, adding: boolean) {
    setLabels((prev) =>
      adding ? [...prev, { id: label.id, name: label.name, color: label.color }] : prev.filter((l) => l.id !== label.id),
    );
  }

  function toggleMemberLocal(member: ContentBoardMember, adding: boolean) {
    setAssignees((prev) =>
      adding
        ? [...prev, { id: member.id, name: member.name, avatarUrl: member.avatarUrl, initials: member.initials }]
        : prev.filter((a) => a.id !== member.id),
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
          <span className="truncate rounded bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
            {card.listName}
          </span>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        {showCover && (
          <div className="flex shrink-0 items-center justify-center border-b border-border bg-muted/40 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem vem do proxy autenticado, não é asset local */}
            <img
              src={coverProxyUrl(clientId, card.coverImageUrl!)}
              alt=""
              className="max-h-56 max-w-[70%] rounded-[var(--radius-card)] object-contain"
              onError={() => setCoverFailed(true)}
            />
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <div ref={leftScrollRef} className="min-w-0 flex-1 overflow-y-auto">
            <div
              className={`sticky top-0 z-10 overflow-hidden border-b border-border bg-card transition-[height] duration-150 ${scrolled ? "h-11" : "h-0"}`}
            >
              <div className="flex h-11 items-center px-7">
                <h3 className="truncate text-sm font-bold text-card-foreground">{card.name}</h3>
              </div>
            </div>

            <div className="p-7 pt-6">
              <h1 className="mb-6 text-xl font-bold text-card-foreground">{card.name}</h1>

              <div className="space-y-6">
                <div className="flex flex-wrap gap-x-10 gap-y-6">
                  <MembersField
                    assignees={assignees}
                    clientId={clientId}
                    cardId={card.id}
                    onToggle={toggleMemberLocal}
                  />

                  <LabelsField
                    labels={labels}
                    clientId={clientId}
                    cardId={card.id}
                    onToggle={toggleLabelLocal}
                  />
                </div>

                <Field label="Data prevista">{formatDueDate(card.dueDate)}</Field>

                <DescriptionField
                  text={description}
                  clientId={clientId}
                  cardId={card.id}
                  onSaved={setDescription}
                />

                <AttachmentsField
                  attachments={attachments}
                  clientId={clientId}
                  onOpenImage={setLightboxTarget}
                  onAddLink={addLinkAttachmentLocal}
                  onAddFile={addFileAttachmentLocal}
                />

                <VideoUploadField clientId={clientId} cardId={card.id} cardName={card.name} />

                {checklist && (
                  <ChecklistField
                    checklist={checklist}
                    onToggle={toggleChecklistItem}
                    onAddItem={addChecklistItemLocal}
                    onDeleteItem={deleteChecklistItemLocal}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 shrink-0 overflow-y-auto border-l border-border bg-muted/30 md:w-[420px]">
            <div className="p-6">
              <ActivityField clientId={clientId} cardId={card.id} onOpenImage={setLightboxTarget} />
            </div>
          </div>
        </div>
      </div>

      {lightboxTarget && (
        <ImageLightbox
          target={lightboxTarget}
          clientId={clientId}
          onClose={() => setLightboxTarget(null)}
        />
      )}
    </div>
  );
}
