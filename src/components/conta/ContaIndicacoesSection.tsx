"use client";

import { ContaField } from "@/components/conta/ContaField";

export type ReferralStatus = "pending" | "converted" | "rewarded" | "disqualified";
export type ReferralLead = { id: string; name: string; contact: string; createdAt: string; status: ReferralStatus };

const STATUS_LABELS: Record<ReferralStatus, { label: string; className: string }> = {
  pending: { label: "Aguardando", className: "bg-muted text-muted-foreground" },
  converted: { label: "Virou cliente", className: "bg-brand-accent/10 text-brand-accent" },
  rewarded: { label: "Desconto aplicado", className: "bg-brand-success/10 text-brand-success" },
  disqualified: { label: "Não qualificou", className: "bg-muted text-muted-foreground" },
};

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
  const rewardedCount = referralLeads.filter((l) => l.status === "rewarded").length;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Indicação de amigos</h2>
      <p className="mb-5 text-xs text-muted-foreground">
        Indique e ganhe <strong className="text-card-foreground">20% de desconto na próxima fatura</strong> quando sua
        indicação assinar um plano a partir de US$ 350.
      </p>

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

      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-semibold text-card-foreground">Quem você já indicou</p>
        {rewardedCount > 0 && (
          <p className="text-xs text-brand-success">
            {rewardedCount} {rewardedCount === 1 ? "desconto ganho" : "descontos ganhos"} 🎉
          </p>
        )}
      </div>
      {referralLeads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma indicação ainda. Compartilhe seu link!</p>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {referralLeads.map((lead) => {
            const status = STATUS_LABELS[lead.status];
            return (
              <div key={lead.id} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-3 py-2.5 text-sm">
                <span className="truncate text-card-foreground">{lead.name}</span>
                <span className="truncate text-muted-foreground">{lead.contact}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                  {status.label}
                </span>
                <span className="text-right text-xs text-muted-foreground">{lead.createdAt.slice(0, 10)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
