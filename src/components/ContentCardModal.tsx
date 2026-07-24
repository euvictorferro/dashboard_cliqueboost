// src/components/ContentCardModal.tsx
"use client";

import { useEffect, useState } from "react";
import type { ContentCard } from "@/lib/trello";

function formatDueDate(dueDate: number | null): string {
  if (dueDate === null) return "Sem prazo";
  return new Date(dueDate).toLocaleDateString("pt-BR");
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
              {card.description ? (
                <p className="whitespace-pre-wrap">{card.description}</p>
              ) : (
                <span className="text-muted-foreground">Sem descrição</span>
              )}
            </Field>

            <Field label="Data prevista">{formatDueDate(card.dueDate)}</Field>

            <Field label="Responsável">
              {card.assignees.length === 0 ? (
                <span className="text-muted-foreground">Sem responsável</span>
              ) : (
                card.assignees.join(", ")
              )}
            </Field>

            <Field label="Anexos">
              {card.attachments.length === 0 ? (
                <span className="text-muted-foreground">Sem anexos</span>
              ) : (
                <ul className="space-y-1">
                  {card.attachments.map((a) => (
                    <li key={a.url}>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-accent hover:underline"
                      >
                        🔗 {a.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
