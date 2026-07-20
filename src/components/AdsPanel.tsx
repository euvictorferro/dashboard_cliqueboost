import { ADS_METRICS, WHATSAPP_LINK, getAdsSnapshot } from "@/lib/ads";
import { MetricCard } from "./MetricCard";

export function AdsPanel({ clientId, active }: { clientId: string; active: boolean }) {
  if (!active) {
    return (
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border">
        <div className="pointer-events-none grid grid-cols-2 gap-3 p-4 blur-sm sm:grid-cols-4">
          {Object.values(ADS_METRICS).map((m) => (
            <MetricCard key={m.label} label={m.label} description={m.description} value="—" />
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 px-6 text-center">
          <span className="text-2xl">🔒</span>
          <p className="text-base font-semibold text-card-foreground">
            Você não tem anúncios ativos no momento
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Essa tela é exclusiva para ver as métricas de ADS. Se quiser começar a rodar tráfego
            pago para seu negócio, fale com nossa equipe.
          </p>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[var(--radius-card)] bg-brand-primary px-4 py-2 text-sm font-medium text-white"
          >
            Falar no WhatsApp
          </a>
        </div>
      </div>
    );
  }

  const { metrics, bestCreative } = getAdsSnapshot(clientId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(ADS_METRICS) as (keyof typeof ADS_METRICS)[]).map((key) => (
          <MetricCard
            key={key}
            label={ADS_METRICS[key].label}
            description={ADS_METRICS[key].description}
            value={
              key === "roas"
                ? `${metrics[key]}x`
                : key === "spend" || key === "cpa" || key === "cpc" || key === "cpr" || key === "cpm"
                  ? `R$ ${metrics[key].toLocaleString("pt-BR")}`
                  : metrics[key].toLocaleString("pt-BR")
            }
          />
        ))}
      </div>
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <h3 className="text-sm font-medium text-card-foreground">Melhor criativo</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {bestCreative.name} — {bestCreative.result}
        </p>
      </div>
    </div>
  );
}
