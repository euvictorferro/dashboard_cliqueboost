"use client";

export type Payment = { id: string; paidAt: string; amount: number | null };

function paymentStatusTone(status: string): "success" | "warning" {
  return /em dia|ativo|pago|adimplente/i.test(status) ? "success" : "warning";
}

export function ContaFaturamentoSection({
  planName,
  paymentStatus,
  contractDuration,
  payments,
}: {
  planName: string | null;
  paymentStatus: string | null;
  contractDuration: string;
  payments: Payment[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-sm font-bold text-card-foreground">Faturamento</h2>
      <p className="mb-5 text-xs text-muted-foreground">Plano, pagamentos e tempo de contrato.</p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md bg-muted px-4 py-3">
          <p className="mb-1 text-xs text-muted-foreground">Plano</p>
          <p className="text-lg font-bold text-card-foreground">{planName ?? "Não configurado"}</p>
        </div>
        <div className="rounded-md bg-muted px-4 py-3">
          <p className="mb-1 text-xs text-muted-foreground">Status de pagamento</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-card-foreground">{paymentStatus ?? "Não configurado"}</p>
            {paymentStatus && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  paymentStatusTone(paymentStatus) === "success"
                    ? "bg-brand-success/10 text-brand-success"
                    : "bg-amber-500/10 text-amber-600"
                }`}
              >
                {paymentStatusTone(paymentStatus) === "success" ? "Em dia" : "Atenção"}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-md bg-muted px-4 py-3">
          <p className="mb-1 text-xs text-muted-foreground">Tempo de contrato</p>
          <p className="text-lg font-bold text-card-foreground">{contractDuration}</p>
        </div>
      </div>

      <p className="mb-2 text-xs font-semibold text-card-foreground">Histórico de pagamentos</p>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-card-foreground">{p.paidAt}</span>
              {p.amount != null && (
                <span className="font-medium tabular-nums text-card-foreground">R$ {p.amount.toFixed(2)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
