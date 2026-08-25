"use client";

import { useEffect } from "react";
import type { AdsCreative } from "@/lib/ads";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CreativePreviewModal({
  creative,
  currency,
  onClose,
}: {
  creative: AdsCreative;
  currency: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-card-foreground">{creative.name}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        {creative.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem externa da Meta, sem domínio fixo pro loader do next/image
          <img
            src={creative.thumbnailUrl}
            alt={creative.name}
            className="mb-4 w-full rounded-[var(--radius-card)] object-cover"
          />
        ) : (
          <div className="mb-4 flex h-40 w-full items-center justify-center rounded-[var(--radius-card)] bg-muted text-sm text-muted-foreground">
            Preview indisponível
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Investimento</p>
            <p className="font-semibold text-card-foreground">{money(creative.spend)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Resultados</p>
            <p className="font-semibold text-card-foreground">{creative.results.toLocaleString("pt-BR")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CPA</p>
            <p className="font-semibold text-card-foreground">{creative.results > 0 ? money(creative.cpa) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CTR</p>
            <p className="font-semibold text-card-foreground">{creative.ctr.toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
