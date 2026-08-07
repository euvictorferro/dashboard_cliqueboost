"use client";

import { ContaField } from "@/components/conta/ContaField";

export type ReferralLead = { id: string; name: string; contact: string; createdAt: string };

export function ContaIndicacoesSection({
  referralLink,
  copyStatus,
  onCopy,
  referralLeads,
}: {
  referralLink: string;
  copyStatus: "idle" | "copied";
  onCopy: () => void;
  referralLeads: ReferralLead[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Indicação de amigos</h2>
      <p className="mb-5 text-xs text-muted-foreground">Compartilhe seu link e acompanhe quem você já indicou.</p>

      <div className="mb-6 flex items-end gap-2">
        <div className="flex-1">
          <ContaField label="Seu link de indicação">
            <span className="block truncate">{referralLink}</span>
          </ContaField>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted"
        >
          {copyStatus === "copied" ? "Copiado!" : "Copiar"}
        </button>
      </div>

      <p className="mb-2 text-xs font-semibold text-card-foreground">Quem você já indicou</p>
      {referralLeads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma indicação ainda.</p>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {referralLeads.map((lead) => (
            <div key={lead.id} className="grid grid-cols-3 gap-2 py-2.5 text-sm">
              <span className="truncate text-card-foreground">{lead.name}</span>
              <span className="truncate text-muted-foreground">{lead.contact}</span>
              <span className="text-right text-muted-foreground">{lead.createdAt.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
