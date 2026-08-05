"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

const INVITE_MESSAGES = [
  "Como está sendo sua experiência com a Clique Boost esse mês? Sua avaliação nos ajuda a evoluir!",
  "Ei, ainda não recebemos sua nota desse mês — leva 10 segundos, prometemos!",
  "Sei que já te perguntei, mas... avalia a gente aí? 👀",
  "Terceira tentativa! Sua opinião realmente importa pra gente (e pro seu contentzinho).",
  "Tá bom, última insistência por hoje: como foi o mês? 🙏",
];

const STAR_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function inviteMessageFor(dismissCount: number): string {
  const index = Math.min(dismissCount, INVITE_MESSAGES.length - 1);
  return INVITE_MESSAGES[index];
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: "full" | "half" | "empty" }) {
  const fillId = "rating-star-half";
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={fillId}>
          <stop offset="50%" stopColor="currentColor" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6L12 17l-5.9 3.6 1.4-6.6-5-4.6 6.6-.7L12 2.5z"
        fill={filled === "full" ? "currentColor" : filled === "half" ? `url(#${fillId})` : "none"}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Status = "invite" | "form" | "sending" | "sent";

export function RatingPopup({
  clientId,
  accessKey,
  monthRef,
  dismissCount,
  onClose,
  onSubmitted,
}: {
  clientId: string;
  accessKey: string;
  monthRef: string;
  dismissCount: number;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [status, setStatus] = useState<Status>("invite");
  const [stars, setStars] = useState<number | null>(null);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayStars = hoverStars ?? stars ?? 0;

  function handleSubmit() {
    if (!stars || status === "sending") return;
    setStatus("sending");
    setErrorMsg(null);

    fetch(`/api/ratings/${clientId}?key=${encodeURIComponent(accessKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month_ref: monthRef, stars, feedback: feedback.trim() || null }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("sent");
        onSubmitted();
      })
      .catch(() => {
        setStatus("form");
        setErrorMsg("Não foi possível enviar agora, tenta de novo.");
      });
  }

  // ponytail: portal pro <body> — mesmo motivo do BugReportModal (nasce dentro do AppFrame,
  // que tem a Sidebar com position:sticky, criando contexto de empilhamento próprio).
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        {status === "invite" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-card-foreground">{inviteMessageFor(dismissCount)}</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={() => setStatus("form")}
                className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
              >
                Avaliar
              </button>
            </div>
          </div>
        )}

        {(status === "form" || status === "sending") && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-card-foreground">Sua avaliação</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex justify-center gap-1 text-brand-primary" onMouseLeave={() => setHoverStars(null)}>
              {STAR_VALUES.map((value) => {
                const filled: "full" | "half" | "empty" =
                  displayStars >= value ? "full" : displayStars >= value - 0.5 ? "half" : "empty";
                return (
                  <button
                    key={value}
                    type="button"
                    onMouseEnter={() => setHoverStars(value)}
                    onClick={() => setStars(value)}
                    aria-label={`${value} estrelas`}
                    className="cursor-pointer"
                  >
                    <StarIcon filled={filled} />
                  </button>
                );
              })}
            </div>
            {stars !== null && <p className="text-center text-xs text-muted-foreground">{stars} de 5 estrelas</p>}

            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Conte mais, se quiser (opcional)"
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />

            {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!stars || status === "sending"}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-40"
            >
              {status === "sending" ? "Enviando..." : "Enviar"}
            </button>
          </div>
        )}

        {status === "sent" && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-sm font-semibold text-card-foreground">Valeu pela avaliação! 🎉</p>
            <p className="text-sm text-muted-foreground">Isso nos ajuda demais a melhorar a plataforma.</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
