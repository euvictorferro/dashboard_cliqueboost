"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";

const INVITE_MESSAGES = [
  "Compartilhe como está sendo sua experiência com a Clique Boost esse mês. Sua avaliação nos ajuda a evoluir!",
  "Ei, ainda não recebemos sua nota desse mês — leva 10 segundos, prometemos!",
  "Sei que já te perguntei, mas... avalia a gente aí? 👀",
  "Terceira tentativa! Sua opinião realmente importa pra gente (e pro seu contentzinho).",
  "Tá bom, última insistência por hoje: como foi o mês? 🙏",
];

const MONTHS_PT_FULL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const STAR_LABELS = [
  "Insatisfeito",
  "Deixou a desejar",
  "Não atendeu as expectativas",
  "Tá ruim",
  "Razoável",
  "Bom",
  "Muito bom",
  "Ótimo",
  "Top demais",
  "Ultramegablaster avaliação 🚀",
];

function inviteMessageFor(dismissCount: number): string {
  const index = Math.min(dismissCount, INVITE_MESSAGES.length - 1);
  return INVITE_MESSAGES[index];
}

function monthNameFor(monthRef: string): string {
  const monthIndex0 = Number(monthRef.slice(5, 7)) - 1;
  return MONTHS_PT_FULL[monthIndex0] ?? monthRef;
}

function fireConfetti() {
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StarRatingIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6L12 17l-5.9 3.6 1.4-6.6-5-4.6 6.6-.7L12 2.5z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6L12 17l-5.9 3.6 1.4-6.6-5-4.6 6.6-.7L12 2.5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-10-9.4C.5 7.6 2.4 4 6 4c2.1 0 3.6 1.1 4.5 2.4.3.4.9.4 1.2 0C12.6 5.1 14.1 4 16.2 4c3.6 0 5.5 3.6 4 7.1-2.5 4.8-10 9.4-10 9.4z"
        fill="currentColor"
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
  monthRef,
  dismissCount,
  onClose,
  onSubmitted,
}: {
  clientId: string;
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
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    };
  }, []);

  const displayStars = hoverStars ?? stars ?? 0;

  function handleClose() {
    if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    onClose();
  }

  function handleSubmit() {
    if (!stars || status === "sending") return;
    setStatus("sending");
    setErrorMsg(null);

    fetch(`/api/ratings/${clientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month_ref: monthRef, stars: stars / 2, feedback: feedback.trim() || null }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("sent");
        fireConfetti();
        // fecha sozinho depois de mostrar o agradecimento, sem depender de ação do cliente
        autoCloseTimeoutRef.current = setTimeout(() => onSubmitted(), 2500);
      })
      .catch(() => {
        setStatus("form");
        setErrorMsg("Não foi possível enviar agora, tenta de novo.");
      });
  }

  // ponytail: portal pro <body> — mesmo motivo do BugReportModal (nasce dentro do AppFrame,
  // que tem a Sidebar com position:sticky, criando contexto de empilhamento próprio).
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
      <div
        className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "invite" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar"
              className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
            >
              <CloseIcon />
            </button>
            <span className="text-brand-primary">
              <StarRatingIcon />
            </span>
            <h2 className="text-base font-bold text-card-foreground">Avaliação de {monthNameFor(monthRef)}</h2>
            <p className="text-sm text-muted-foreground">{inviteMessageFor(dismissCount)}</p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={handleClose}
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
              <h2 className="text-sm font-bold text-card-foreground">Compartilhe sua experiência</h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Fechar"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-1 text-brand-primary" onMouseLeave={() => setHoverStars(null)}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  onMouseEnter={() => setHoverStars(value)}
                  onClick={() => setStars(value)}
                  aria-label={`${value} estrelas`}
                  className="cursor-pointer"
                >
                  <StarIcon filled={displayStars >= value} />
                </button>
              ))}
            </div>
            {displayStars > 0 && (
              <p className="text-center text-xs text-muted-foreground">{STAR_LABELS[displayStars - 1]}</p>
            )}

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
            <span className="text-red-500">
              <HeartIcon />
            </span>
            <p className="text-sm font-semibold text-card-foreground">Agradecemos sua avaliação!</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
