// src/components/ContentCardModal.tsx
"use client";

import { useEffect, useState } from "react";
import type { ContentActivity, ContentCard } from "@/lib/trello";
import { renderMarkdown } from "./markdown";

function formatDueDate(dueDate: number | null): string {
  if (dueDate === null) return "Sem prazo";
  return new Date(dueDate).toLocaleDateString("pt-BR");
}

function formatActivityDate(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 11 11" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M8.3 3.3L4.6 7a1.5 1.5 0 1 1-2.1-2.1l3.7-3.7a1 1 0 1 1 1.4 1.4L4.2 6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-card-foreground">{children}</div>
    </div>
  );
}

function ChecklistField({ checklist }: { checklist: NonNullable<ContentCard["checklist"]> }) {
  const percent = checklist.total === 0 ? 0 : Math.round((checklist.checked / checklist.total) * 100);
  return (
    <Field label={`Checklist (${checklist.checked}/${checklist.total})`}>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand-accent" style={{ width: `${percent}%` }} />
      </div>
      <ul className="space-y-1.5">
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

function AttachmentsField({
  attachments,
  clientId,
  accessKey,
}: {
  attachments: ContentCard["attachments"];
  clientId: string;
  accessKey: string;
}) {
  const links = attachments.filter((a) => !a.isUpload);
  const files = attachments.filter((a) => a.isUpload);

  return (
    <Field label="Anexos">
      {links.length === 0 && files.length === 0 ? (
        <span className="text-muted-foreground">Sem anexos</span>
      ) : (
        <div className="space-y-3">
          {links.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Links</p>
              <ul className="space-y-1">
                {links.map((a) => (
                  <li key={a.url} className="flex items-center gap-1.5">
                    <LinkIcon />
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                      {a.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {files.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Arquivos</p>
              <ul className="space-y-1.5">
                {files.map((a) => (
                  <li key={a.url} className="flex items-center gap-2">
                    {a.previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- imagem vem do proxy autenticado
                      <img
                        src={`/api/content/${clientId}/cover-proxy?key=${encodeURIComponent(accessKey)}&url=${encodeURIComponent(a.previewUrl)}`}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded object-cover"
                      />
                    )}
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                      {a.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Field>
  );
}

function ActivityField({ clientId, accessKey, cardId }: { clientId: string; accessKey: string; cardId: string }) {
  const [activity, setActivity] = useState<ContentActivity[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setActivity(null);
    setFailed(false);
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

  return (
    <Field label="Comentários e atividade">
      {failed && <span className="text-muted-foreground">Não foi possível carregar.</span>}
      {!failed && activity === null && <span className="text-muted-foreground">Carregando...</span>}
      {!failed && activity !== null && activity.length === 0 && (
        <span className="text-muted-foreground">Sem comentários ou atividade.</span>
      )}
      {!failed && activity !== null && activity.length > 0 && (
        <ul className="space-y-3">
          {activity.map((a) => (
            <li key={a.id} className="flex items-start gap-2">
              {a.authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL externa do Trello
                <img src={a.authorAvatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                  {a.authorInitials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                {a.kind === "comment" ? (
                  <div className="rounded-[var(--radius-card)] bg-muted px-3 py-2">
                    <p className="mb-0.5 text-xs font-semibold">{a.authorName}</p>
                    {renderMarkdown(a.text)}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-card-foreground">{a.authorName}</span> {a.text}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-muted-foreground">{formatActivityDate(a.date)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Field>
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
  const showCover = card.coverImageUrl !== null && !coverFailed;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        {showCover && (
          // eslint-disable-next-line @next/next/no-img-element -- imagem vem do proxy autenticado, não é asset local
          <img
            src={`/api/content/${clientId}/cover-proxy?key=${encodeURIComponent(accessKey)}&url=${encodeURIComponent(card.coverImageUrl!)}`}
            alt=""
            className="h-40 w-full object-cover"
            onError={() => setCoverFailed(true)}
          />
        )}

        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-bold text-card-foreground">{card.name}</h2>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="space-y-4">
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

            <Field label="Descrição">
              {card.description ? renderMarkdown(card.description) : <span className="text-muted-foreground">Sem descrição</span>}
            </Field>

            <Field label="Data prevista">{formatDueDate(card.dueDate)}</Field>

            <Field label="Responsável">
              {card.assignees.length === 0 ? (
                <span className="text-muted-foreground">Sem responsável</span>
              ) : (
                card.assignees.map((a) => a.name).join(", ")
              )}
            </Field>

            {card.checklist && <ChecklistField checklist={card.checklist} />}

            <AttachmentsField attachments={card.attachments} clientId={clientId} accessKey={accessKey} />

            <ActivityField clientId={clientId} accessKey={accessKey} cardId={card.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
