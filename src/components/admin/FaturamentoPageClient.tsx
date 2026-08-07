"use client";

import { useEffect, useState } from "react";

type BillingRow = {
  clientId: string;
  name: string;
  planName: string | null;
  paymentStatus: string | null;
  stripeLinked: boolean;
  lastPaymentAt: string | null;
  lastPaymentAmount: number | null;
};

type BillingData = {
  mrr: number | null;
  activeClients: number;
  paymentsThisMonth: number;
  clients: BillingRow[];
};

function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)]">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function FaturamentoPageClient() {
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/billing")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error();
        return json as BillingData;
      })
      .then(setData)
      .catch(() => setError("Não foi possível carregar o faturamento agora."));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8 sm:px-10">
      <h1 className="text-2xl font-semibold text-foreground">Faturamento</h1>

      {error && <p className="text-sm text-brand-danger">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="MRR" value={data.mrr === null ? "— (Stripe não configurado)" : formatCurrency(data.mrr)} />
            <StatCard label="Clientes ativos" value={String(data.activeClients)} />
            <StatCard label="Pagamentos este mês" value={String(data.paymentsThisMonth)} />
          </div>

          <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
            <div className="grid grid-cols-[1fr_130px_140px_140px_140px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Cliente</span>
              <span>Plano</span>
              <span>Pagamento</span>
              <span>Último pagamento</span>
              <span>Stripe</span>
            </div>
            {data.clients.map((c) => (
              <div
                key={c.clientId}
                className={`grid grid-cols-[1fr_130px_140px_140px_140px] items-center gap-3 border-t border-border px-4 py-3 text-sm ${
                  c.stripeLinked ? "" : "bg-brand-danger/5"
                }`}
              >
                <span className="truncate font-medium text-foreground">{c.name}</span>
                <span className="truncate text-muted-foreground">{c.planName ?? "—"}</span>
                <span className="truncate text-muted-foreground">{c.paymentStatus ?? "—"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {c.lastPaymentAt ? `${c.lastPaymentAt.slice(0, 10)} · ${formatCurrency(c.lastPaymentAmount)}` : "—"}
                </span>
                {c.stripeLinked ? (
                  <span className="text-xs text-brand-success">Vinculado</span>
                ) : (
                  <a href="/admin/clientes" className="text-xs font-medium text-brand-danger hover:underline">
                    Sem vínculo Stripe
                  </a>
                )}
              </div>
            ))}
            {data.clients.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum cliente ainda.</p>}
          </div>
        </>
      )}
    </div>
  );
}
