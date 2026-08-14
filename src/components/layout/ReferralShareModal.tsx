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

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.09-1.33A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2Zm0 18a7.94 7.94 0 0 1-4.05-1.11l-.29-.17-3.02.79.8-2.94-.19-.3A7.95 7.95 0 1 1 12 20Zm4.36-5.96c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.18-.71-.63-1.19-1.42-1.33-1.66-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.4h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.4-.57 1.6-1.13.2-.55.2-1.02.14-1.13-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" strokeWidth="1.6" />
      <path d="M3.5 6l8.5 7 8.5-7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7.2l-5.6-7.3L4 22H1l8.1-9.3L.9 2h7.4l5 6.7L18.9 2Zm-1.3 18h2L6.5 4H4.4l13.2 16Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" strokeWidth="1.6" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SHARE_MESSAGE = "Dá uma olhada na Clique Boost, a agência que cuida do meu marketing:";

export function ReferralShareModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
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

  // ponytail: Instagram não tem um link de compartilhamento web (nunca teve, não é limitação
  // nossa) — a solução padrão do mercado é copiar o link e abrir o Instagram pro cliente colar.
  function shareInstagram() {
    navigator.clipboard?.writeText(referralLink).catch(() => {});
    setShareHint("Link copiado! Cole numa mensagem ou na bio do Instagram.");
    setTimeout(() => setShareHint(null), 4000);
    window.open("https://instagram.com", "_blank", "noopener,noreferrer");
  }

  const shareLinks = [
    {
      label: "WhatsApp",
      icon: <WhatsAppIcon />,
      href: `https://wa.me/?text=${encodeURIComponent(`${SHARE_MESSAGE} ${referralLink}`)}`,
    },
    {
      label: "Email",
      icon: <MailIcon />,
      href: `mailto:?subject=${encodeURIComponent("Confira a Clique Boost")}&body=${encodeURIComponent(`${SHARE_MESSAGE} ${referralLink}`)}`,
    },
    {
      label: "X (Twitter)",
      icon: <TwitterIcon />,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_MESSAGE)}&url=${encodeURIComponent(referralLink)}`,
    },
  ] as const;

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

        <div className="mb-4 flex items-center justify-center gap-3">
          {shareLinks.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Compartilhar no ${s.label}`}
              title={s.label}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-card-foreground transition-colors hover:bg-muted"
            >
              {s.icon}
            </a>
          ))}
          <button
            type="button"
            onClick={shareInstagram}
            aria-label="Compartilhar no Instagram"
            title="Instagram"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-card-foreground transition-colors hover:bg-muted"
          >
            <InstagramIcon />
          </button>
        </div>
        {shareHint && <p className="mb-4 text-center text-xs text-brand-accent">{shareHint}</p>}

        <div className="rounded-md bg-muted p-3">
          <p className="text-xs text-muted-foreground">
            Indique e ganhe <strong className="text-card-foreground">até 20% de desconto</strong> quando sua
            indicação fechar a partir do plano Starter.
          </p>
          <button
            type="button"
            onClick={() => setRulesOpen((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline"
          >
            Ver regras da campanha
            <ChevronDownIcon open={rulesOpen} />
          </button>
          {rulesOpen && (
            <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
              <li>
                Você ganha <strong className="text-card-foreground">20% de desconto numa fatura</strong> pra cada
                indicação que fechar — empilha até <strong className="text-card-foreground">3 indicações por fatura</strong>{" "}
                (máximo de 60% de desconto numa fatura só).
              </li>
              <li>
                Quem você indicou também ganha{" "}
                <strong className="text-card-foreground">20% de desconto fixo na primeira fatura</strong>.
              </li>
              <li>
                Vale pra indicações que fecharem a partir do plano Starter (o plano mais básico da Clique Boost).
              </li>
              <li>Programa por tempo indeterminado, sem data pra acabar.</li>
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
