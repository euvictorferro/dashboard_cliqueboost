"use client";

import { useState } from "react";
import { ReferralShareModal } from "./ReferralShareModal";

function GiftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2" y="5.5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 5.5h11v2h-11z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 5.5v7M7 5.5C7 3.5 4.5 2 3.7 3.2 3 4.3 5 5.5 7 5.5ZM7 5.5c0-2 2.5-3.5 3.3-2.3.7 1.1-1.3 2.3-3.3 2.3Z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function ReferralPromoCard({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-2 flex w-full items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
          <GiftIcon />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-card-foreground">Compartilhe a Clique</span>
          <span className="block truncate text-[11px] text-muted-foreground">Economize até $300 na assinatura</span>
        </span>
      </button>
      {open && <ReferralShareModal clientId={clientId} onClose={() => setOpen(false)} />}
    </>
  );
}
