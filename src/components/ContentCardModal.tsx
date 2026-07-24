// src/components/ContentCardModal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { ContentActivity, ContentCard } from "@/lib/trello";
import { renderMarkdown } from "./markdown";
import { AssigneeAvatars } from "./AssigneeAvatars";
import { AttachmentIcon, ChecklistIcon, CommentsIcon, DescriptionIcon, DownloadIcon, LinkIcon } from "./icons";

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

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckboxIcon({ checked }: { checked: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
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

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-card-foreground">
        {icon}
        {label}
      </p>
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

function ChecklistField({ checklist }: { checklist: NonNullable<ContentCard["checklist"]> }) {
  const percent = checklist.total === 0 ? 0 : Math.round((checklist.checked / checklist.total) * 100);
  return (
    <Field label={`Checklist (${checklist.checked}/${checklist.total})`} icon={<ChecklistIcon size={14} />}>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand-accent" style={{ width: `${percent}%` }} />
      </div>
      <ul className="space-y-2">
        {checklist.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <CheckboxIcon checked={item.checked} />
            <span className={item.checked ? "text-muted-foreground line-through" : ""}>{item.name}</span>
          </li>
        ))}
      </ul>
    </Field>
  );
}

function LinkRow({ attachment }: { attachment: ContentCard["attachments"][number] }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  let domain = "";
  try {
    domain = new URL(attachment.url).hostname;
  } catch {
    // ponytail: url inválida (raro) — cai no ícone genérico
  }

  return (
    <li className="flex items-center gap-2">
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
  attachment: ContentCard["attachments"][number];
  clientId: string;
  accessKey: string;
  onOpenImage: (attachment: ContentCard["attachments"][number]) => void;
}) {
  const canPreview = attachment.previewUrl !== null;

  return (
    <li className="flex items-center gap-2.5">
      {canPreview ? (
        <button type="button" onClick={() => onOpenImage(attachment)} className="shrink-0">
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
          <button
            type="button"
            onClick={() => onOpenImage(attachment)}
            className="block max-w-full truncate text-left text-brand-accent hover:underline"
          >
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
}: {
  attachments: ContentCard["attachments"];
  clientId: string;
  accessKey: string;
  onOpenImage: (attachment: ContentCard["attachments"][number]) => void;
}) {
  const links = attachments.filter((a) => !a.isUpload);
  const files = attachments.filter((a) => a.isUpload);

  return (
    <Field label="Anexos" icon={<AttachmentIcon size={14} />}>
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

// ponytail: sidebar clara (#f8f8f8) por pedido explícito, mesmo com o resto do app em tema
// escuro — por isso usa cores neutras hardcoded aqui em vez das classes do tema (que são claras
// pensando em fundo escuro e ficariam invisíveis num fundo claro).
function ActivityField({ clientId, accessKey, cardId }: { clientId: string; accessKey: string; cardId: string }) {
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

  const creationOnly = activity?.filter((a) => a.isCreation) ?? [];
  const collapsedView = creationOnly.length > 0 ? creationOnly : (activity?.slice(-1) ?? []);
  const visible = showDetails ? (activity ?? []) : collapsedView;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-bold text-neutral-900">
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

      {failed && <span className="text-sm text-neutral-500">Não foi possível carregar.</span>}
      {!failed && activity === null && <span className="text-sm text-neutral-500">Carregando...</span>}
      {!failed && activity !== null && activity.length === 0 && (
        <span className="text-sm text-neutral-500">Sem comentários ou atividade.</span>
      )}
      {!failed && activity !== null && activity.length > 0 && (
        <ul className="space-y-4">
          {visible.map((a) => (
            <li key={a.id} className="flex items-start gap-2">
              {a.authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL externa do Trello
                <img src={a.authorAvatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-700">
                  {a.authorInitials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-neutral-800">
                  <span className="font-bold text-neutral-900">{a.authorName}</span> {a.text}
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
  attachment,
  clientId,
  accessKey,
  onClose,
}: {
  attachment: ContentCard["attachments"][number];
  clientId: string;
  accessKey: string;
  onClose: () => void;
}) {
  const src = coverProxyUrl(clientId, accessKey, attachment.largePreviewUrl ?? attachment.previewUrl!);

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
            href={src}
            download={attachment.name}
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
        <img src={src} alt={attachment.name} className="max-h-[80vh] max-w-full rounded object-contain" />
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
  const [lightboxAttachment, setLightboxAttachment] = useState<ContentCard["attachments"][number] | null>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const showCover = card.coverImageUrl !== null && !coverFailed;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !lightboxAttachment) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, lightboxAttachment]);

  useEffect(() => {
    const el = leftScrollRef.current;
    if (!el) return;
    function onScroll() {
      setScrolled(el!.scrollTop > 24);
    }
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
          <h3
            className={`truncate text-sm font-bold text-card-foreground transition-opacity duration-150 ${scrolled ? "opacity-100" : "opacity-0"}`}
          >
            {card.name}
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div ref={leftScrollRef} className="min-w-0 flex-1 overflow-y-auto p-7">
            {showCover && (
              // eslint-disable-next-line @next/next/no-img-element -- imagem vem do proxy autenticado, não é asset local
              <img
                src={coverProxyUrl(clientId, accessKey, card.coverImageUrl!)}
                alt=""
                className="mb-6 h-40 w-full rounded-[var(--radius-card)] object-cover"
                onError={() => setCoverFailed(true)}
              />
            )}

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

              {card.checklist && <ChecklistField checklist={card.checklist} />}

              <AttachmentsField
                attachments={card.attachments}
                clientId={clientId}
                accessKey={accessKey}
                onOpenImage={setLightboxAttachment}
              />
            </div>
          </div>

          <div
            className="min-w-0 shrink-0 overflow-y-auto border-l border-border md:w-80"
            style={{ backgroundColor: "#f8f8f8" }}
          >
            <div className="p-6">
              <ActivityField clientId={clientId} accessKey={accessKey} cardId={card.id} />
            </div>
          </div>
        </div>
      </div>

      {lightboxAttachment && (
        <ImageLightbox
          attachment={lightboxAttachment}
          clientId={clientId}
          accessKey={accessKey}
          onClose={() => setLightboxAttachment(null)}
        />
      )}
    </div>
  );
}
