"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PAGE_OPTIONS = ["Dashboard", "Tasks", "Conteúdos", "Calendário", "Atas", "Bunker", "Booster AI", "Conta", "Outra"];
const MAX_SCREENSHOTS = 3;

type Status = "form" | "sending" | "sent";
type Screenshot = { file: File; previewUrl: string };

function CheckCircleIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M9.5 4.5L4.7 9.3a1.8 1.8 0 1 0 2.5 2.5l5.3-5.3a3 3 0 1 0-4.2-4.2L3 7.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BugReportModal({
  clientId,
  currentPageLabel,
  onClose,
}: {
  clientId: string;
  currentPageLabel: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(PAGE_OPTIONS.includes(currentPageLabel) ? currentPageLabel : "Outra");
  const [description, setDescription] = useState("");
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [status, setStatus] = useState<Status>("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotsRef = useRef<Screenshot[]>([]);

  useEffect(() => {
    screenshotsRef.current = screenshots;
  }, [screenshots]);

  useEffect(() => {
    return () => {
      for (const s of screenshotsRef.current) URL.revokeObjectURL(s.previewUrl);
    };
  }, []);

  function handleFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_SCREENSHOTS - screenshots.length;
    const accepted = files.slice(0, room);
    setScreenshots((prev) => [...prev, ...accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
  }

  function removeScreenshot(index: number) {
    setScreenshots((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || status === "sending") return;
    setStatus("sending");
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("page", page);
    formData.append("description", description.trim());
    for (const s of screenshots) formData.append("screenshots", s.file);

    fetch(`/api/bug-reports/${clientId}`, {
      method: "POST",
      body: formData,
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("sent");
      })
      .catch(() => {
        setStatus("form");
        setErrorMsg("Não foi possível enviar agora, tenta de novo.");
      });
  }

  // ponytail: portal pro <body> — o modal é renderizado dentro da sidebar (AccountCard →
  // Sidebar), que tem position:sticky e por isso cria seu próprio contexto de empilhamento;
  // sem o portal, o z-index do modal só vale dentro desse contexto e perde pro conteúdo da
  // página (irmão da sidebar, não filho), deixando gráficos/header por cima do modal.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        {status === "sent" ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="text-brand-success">
              <CheckCircleIcon />
            </span>
            <p className="text-sm font-semibold text-card-foreground">Enviamos o erro para nosso time.</p>
            <p className="text-sm text-muted-foreground">
              Nosso time de developers vai analisar o erro e corrigi-lo assim que possível. Agradecemos pelo seu
              feedback.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-card-foreground">Reportar bug</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
              >
                <CloseIcon />
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground" htmlFor="bug-report-page">
                Página com o problema
              </label>
              <select
                id="bug-report-page"
                value={page}
                onChange={(e) => setPage(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              >
                {PAGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground" htmlFor="bug-report-description">
                O que aconteceu?
              </label>
              <textarea
                id="bug-report-description"
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreve o que você viu, o que esperava ver, e como reproduzir..."
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={screenshots.length >= MAX_SCREENSHOTS}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <PaperclipIcon />
                Anexar print ({screenshots.length}/{MAX_SCREENSHOTS})
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleFilesChosen}
                className="hidden"
              />
              {screenshots.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {screenshots.map((s, i) => (
                    <div key={s.previewUrl} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.previewUrl} alt={s.file.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeScreenshot(i)}
                        aria-label={`Remover ${s.file.name}`}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

            <button
              type="submit"
              disabled={!description.trim() || status === "sending"}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-40"
            >
              {status === "sending" ? "Enviando..." : "Enviar"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
