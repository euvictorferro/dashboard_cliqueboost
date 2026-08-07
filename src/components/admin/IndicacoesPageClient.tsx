"use client";

import { useEffect, useState } from "react";

type ReferralStatus = "pending" | "converted" | "rewarded" | "disqualified";
type AdminLead = {
  id: string;
  name: string;
  contact: string;
  createdAt: string;
  status: ReferralStatus;
  referrerName: string;
  convertedName: string | null;
};

type SimpleClient = { id: string; name: string };

const STATUS_LABELS: Record<ReferralStatus, { label: string; className: string }> = {
  pending: { label: "Aguardando", className: "bg-muted text-muted-foreground" },
  converted: { label: "Virou cliente", className: "bg-brand-primary/10 text-brand-primary" },
  rewarded: { label: "Desconto aplicado", className: "bg-brand-success/10 text-brand-success" },
  disqualified: { label: "Não qualificou", className: "bg-muted text-muted-foreground" },
};

const FILTERS: { value: ReferralStatus | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Aguardando" },
  { value: "converted", label: "Virou cliente" },
  { value: "rewarded", label: "Desconto aplicado" },
  { value: "disqualified", label: "Não qualificou" },
];

export function IndicacoesPageClient() {
  const [leads, setLeads] = useState<AdminLead[] | null>(null);
  const [clients, setClients] = useState<SimpleClient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReferralStatus | "all">("all");
  const [converting, setConverting] = useState<string | null>(null);

  function load() {
    Promise.all([
      fetch("/api/admin/referrals").then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data.leads as AdminLead[];
      }),
      fetch("/api/admin/clients").then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return (data.clients as { id: string; name: string; active: boolean }[]).filter((c) => c.active);
      }),
    ])
      .then(([leadsData, clientsData]) => {
        setLeads(leadsData);
        setClients(clientsData);
      })
      .catch(() => setError("Não foi possível carregar as indicações agora."));
  }

  useEffect(load, []);

  async function handleConvert(leadId: string, convertedClientId: string) {
    setConverting(leadId);
    try {
      await fetch(`/api/admin/referrals/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convertedClientId }),
      });
      load();
    } finally {
      setConverting(null);
    }
  }

  const filtered = leads?.filter((l) => filter === "all" || l.status === filter) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8 sm:px-10">
      <h1 className="text-2xl font-semibold text-foreground">Indicações</h1>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.value ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-brand-danger">{error}</p>}
      {leads === null && !error && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {leads && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          <div className="grid grid-cols-[1fr_1fr_1fr_100px_140px_160px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Indicador</span>
            <span>Indicado</span>
            <span>Contato</span>
            <span>Data</span>
            <span>Status</span>
            <span>Ação</span>
          </div>
          {filtered.map((lead) => {
            const status = STATUS_LABELS[lead.status];
            return (
              <div key={lead.id} className="grid grid-cols-[1fr_1fr_1fr_100px_140px_160px] items-center gap-3 border-t border-border px-4 py-3 text-sm">
                <span className="truncate text-foreground">{lead.referrerName}</span>
                <span className="truncate text-foreground">{lead.convertedName ?? lead.name}</span>
                <span className="truncate text-muted-foreground">{lead.contact}</span>
                <span className="text-xs text-muted-foreground">{lead.createdAt.slice(0, 10)}</span>
                <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
                {lead.status === "pending" ? (
                  <select
                    disabled={converting === lead.id}
                    defaultValue=""
                    onChange={(e) => e.target.value && handleConvert(lead.id, e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none disabled:opacity-60"
                  >
                    <option value="" disabled>
                      Marcar conversão
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma indicação nesse filtro.</p>}
        </div>
      )}
    </div>
  );
}
