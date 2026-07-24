// src/components/ContentCardModal.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ContentActivity, ContentAttachment, ContentCard, ContentChecklist, ContentChecklistItem } from "@/lib/trello";
import { renderMarkdown } from "./markdown";
import { AssigneeAvatars } from "./AssigneeAvatars";
import { AttachmentIcon, ChecklistIcon, CommentsIcon, DescriptionIcon, DownloadIcon, LinkIcon, TrashIcon } from "./icons";

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

function coverProxyUrl(clientId: string, accessKey: string, url: string): string {
  return `/api/content/${clientId}/cover-proxy?key=${encodeURIComponent(accessKey)}&url=${encodeURIComponent(url)}`;
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

function Field({
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

function DescriptionField({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 360;
  const collapsed = isLong && !expanded;

  return (
    <Field label="Descrição" icon={<DescriptionIcon size={14} />}>
      {text ? (
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
  accessKey,
  onOpenImage,
}: {
  attachment: ContentAttachment;
  clientId: string;
  accessKey: string;
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
            src={coverProxyUrl(clientId, accessKey, attachment.previewUrl!)}
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
  accessKey,
  onOpenImage,
  onAddLink,
}: {
  attachments: ContentAttachment[];
  clientId: string;
  accessKey: string;
  onOpenImage: (target: LightboxTarget) => void;
  onAddLink: (url: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
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
        <div className="mb-3 flex items-center gap-2">
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
      )}
      {error && <p className="mb-2 text-xs text-red-500">Não foi possível anexar esse link.</p>}
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
                  <FileRow key={a.url} attachment={a} clientId={clientId} accessKey={accessKey} onOpenImage={onOpenImage} />
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
  accessKey,
  cardId,
  onPosted,
}: {
  clientId: string;
  accessKey: string;
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
      const res = await fetch(`/api/content/${clientId}/card/${cardId}/activity?key=${encodeURIComponent(accessKey)}`, {
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
        className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-neutral-500"
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

// ponytail: sidebar clara (#f8f8f8) por pedido explícito, mesmo com o resto do app em tema
// escuro — por isso usa cores neutras hardcoded aqui em vez das classes do tema (que são claras
// pensando em fundo escuro e ficariam invisíveis num fundo claro).
function ActivityField({
  clientId,
  accessKey,
  cardId,
  onOpenImage,
}: {
  clientId: string;
  accessKey: string;
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
    fetch(`/api/content/${clientId}/card/${cardId}/activity?key=${encodeURIComponent(accessKey)}`)
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
  }, [clientId, accessKey, cardId]);

  function openAttachmentRef(ref: NonNullable<ContentActivity["attachmentRef"]>) {
    if (ref.previewUrl) {
      onOpenImage({ name: ref.name, imageUrl: ref.previewUrl, downloadUrl: ref.url });
    } else {
      window.open(coverProxyUrl(clientId, accessKey, ref.url), "_blank", "noopener,noreferrer");
    }
  }

  const creationOnly = activity?.filter((a) => a.isCreation) ?? [];
  const collapsedView = creationOnly.length > 0 ? creationOnly : (activity?.slice(-1) ?? []);
  const visible = showDetails ? (activity ?? []) : collapsedView;

  return (
    <div>
      <div className="mb-3 flex flex-nowrap items-center justify-between gap-3">
        <p className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-bold text-neutral-900">
          <CommentsIcon size={14} />
          Comentários e atividade
        </p>
        {activity !== null && activity.length > 1 && (
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-200"
          >
            {showDetails ? "Fechar Detalhes" : "Mostrar Detalhes"}
          </button>
        )}
      </div>

      <CommentBox
        clientId={clientId}
        accessKey={accessKey}
        cardId={cardId}
        onPosted={(newActivity) => {
          setActivity((prev) => (prev ? [newActivity, ...prev] : [newActivity]));
          setShowDetails(true);
        }}
      />

      {failed && <span className="text-sm text-neutral-500">Não foi possível carregar.</span>}
      {!failed && activity === null && <span className="text-sm text-neutral-500">Carregando...</span>}
      {!failed && activity !== null && activity.length === 0 && (
        <span className="text-sm text-neutral-500">Sem comentários ou atividade.</span>
      )}
      {!failed && activity !== null && activity.length > 0 && (
        <ul className="space-y-4">
          {visible.map((a) => (
            <li key={a.id} className="flex items-start gap-2.5">
              {a.authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL externa do Trello
                <img src={a.authorAvatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700">
                  {a.authorInitials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-800">
                  <span className="font-bold text-neutral-900">{a.authorName}</span>{" "}
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
  accessKey,
  onClose,
}: {
  target: LightboxTarget;
  clientId: string;
  accessKey: string;
  onClose: () => void;
}) {
  const src = coverProxyUrl(clientId, accessKey, target.imageUrl);
  const downloadSrc = coverProxyUrl(clientId, accessKey, target.downloadUrl);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-6"
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
  accessKey,
  onClose,
}: {
  card: ContentCard;
  clientId: string;
  accessKey: string;
  onClose: () => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lightboxTarget, setLightboxTarget] = useState<LightboxTarget | null>(null);
  const [checklist, setChecklist] = useState(card.checklist);
  const [attachments, setAttachments] = useState(card.attachments);
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
      const res = await fetch(`/api/content/${clientId}/card/${card.id}/checklist/toggle?key=${encodeURIComponent(accessKey)}`, {
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
    const res = await fetch(`/api/content/${clientId}/card/${card.id}/checklist/items?key=${encodeURIComponent(accessKey)}`, {
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
      const res = await fetch(`/api/content/${clientId}/card/${card.id}/checklist/items?key=${encodeURIComponent(accessKey)}`, {
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
    const res = await fetch(`/api/content/${clientId}/card/${card.id}/attachments?key=${encodeURIComponent(accessKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error();
    const data: { attachment: ContentAttachment } = await res.json();
    setAttachments((prev) => [...prev, data.attachment]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
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
              src={coverProxyUrl(clientId, accessKey, card.coverImageUrl!)}
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
                  <Field label="Membros">
                    {card.assignees.length === 0 ? (
                      <span className="text-muted-foreground">Sem responsável</span>
                    ) : (
                      <AssigneeAvatars assignees={card.assignees} size="sm" />
                    )}
                  </Field>

                  <Field label="Labels">
                    {card.labels.length === 0 ? (
                      <span className="text-muted-foreground">Sem labels</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {card.labels.map((label, i) => (
                          <span
                            key={`${label.name}-${i}`}
                            className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                            style={{ backgroundColor: label.color }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </Field>
                </div>

                <Field label="Data prevista">{formatDueDate(card.dueDate)}</Field>

                <DescriptionField text={card.description} />

                <AttachmentsField
                  attachments={attachments}
                  clientId={clientId}
                  accessKey={accessKey}
                  onOpenImage={setLightboxTarget}
                  onAddLink={addLinkAttachmentLocal}
                />

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

          <div
            className="min-w-0 shrink-0 overflow-y-auto border-l border-border md:w-[420px]"
            style={{ backgroundColor: "#f8f8f8" }}
          >
            <div className="p-6">
              <ActivityField clientId={clientId} accessKey={accessKey} cardId={card.id} onOpenImage={setLightboxTarget} />
            </div>
          </div>
        </div>
      </div>

      {lightboxTarget && (
        <ImageLightbox
          target={lightboxTarget}
          clientId={clientId}
          accessKey={accessKey}
          onClose={() => setLightboxTarget(null)}
        />
      )}
    </div>
  );
}
