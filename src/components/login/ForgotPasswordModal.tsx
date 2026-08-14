"use client";

import { createPortal } from "react-dom";

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ponytail: ainda não existe fluxo de redefinição de senha self-service (sem token de
// reset, sem envio de email) — enquanto isso, direciona pro time via WhatsApp.
export function ForgotPasswordModal({ whatsappLink, onClose }: { whatsappLink: string; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-card-foreground">Esqueci a senha</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <p className="mb-5 text-sm text-muted-foreground">
          Peça pra equipe da Clique Boost redefinir sua senha no WhatsApp.
        </p>

        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
        >
          Falar no WhatsApp
        </a>
      </div>
    </div>,
    document.body
  );
}
