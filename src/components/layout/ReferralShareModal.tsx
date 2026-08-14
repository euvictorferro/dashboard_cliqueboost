"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ReferralShareModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const referralLink = typeof window !== "undefined" ? `${window.location.origin}/r/${clientId}` : "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(referralLink)}`;

  function copy() {
    navigator.clipboard
      ?.writeText(referralLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-card-foreground">Compartilhe a Clique</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mb-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR code do seu link de indicação" width={180} height={180} className="rounded-md" />
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground">
            {referralLink}
          </span>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-md bg-brand-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-primary/90"
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>

        <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          Indique e ganhe <strong className="text-card-foreground">20% de desconto na próxima fatura</strong> quando
          sua indicação assinar um plano a partir de US$ 350.
        </p>
      </div>
    </div>,
    document.body
  );
}
