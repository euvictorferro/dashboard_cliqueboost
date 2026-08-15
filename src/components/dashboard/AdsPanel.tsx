import { ADS_METRICS, WHATSAPP_LINK, getAdsSnapshot } from "@/lib/ads";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ReachBarChart } from "@/components/dashboard/ReachBarChart";

function formatMetric(key: keyof ReturnType<typeof getAdsSnapshot>["metrics"], value: number): string {
  if (key === "roas") return `${value}x`;
  if (key === "spend" || key === "cpa" || key === "cpc" || key === "cpr" || key === "cpm") {
    return `R$ ${value.toLocaleString("pt-BR")}`;
  }
  return value.toLocaleString("pt-BR");
}

export function AdsPanel({ clientId, active }: { clientId: string; active: boolean }) {
  if (!active) {
    return (
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]">
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

  const { metrics, spendTrend, clicksTrend, roasTrend, bestCreative } = getAdsSnapshot(clientId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_1.6fr]">
        <MetricCard label={ADS_METRICS.cpa.label} description={ADS_METRICS.cpa.description} value={formatMetric("cpa", metrics.cpa)} />
        <MetricCard label={ADS_METRICS.cpc.label} description={ADS_METRICS.cpc.description} value={formatMetric("cpc", metrics.cpc)} />
        <MetricCard label={ADS_METRICS.cpm.label} description={ADS_METRICS.cpm.description} value={formatMetric("cpm", metrics.cpm)} />

        <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] lg:row-span-2">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">{ADS_METRICS.spend.label}</h3>
          <div className="h-56">
            <ReachBarChart data={spendTrend} />
          </div>
        </div>

        <MetricCard
          label={ADS_METRICS.clicks.label}
          description={ADS_METRICS.clicks.description}
          value={formatMetric("clicks", metrics.clicks)}
          sparkline={clicksTrend}
        />
        <MetricCard
          label={ADS_METRICS.roas.label}
          description={ADS_METRICS.roas.description}
          value={formatMetric("roas", metrics.roas)}
          sparkline={roasTrend}
        />
        <MetricCard
          label={ADS_METRICS.cpr.label}
          description={ADS_METRICS.cpr.description}
          value={formatMetric("cpr", metrics.cpr)}
        />
      </div>

      <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
        <h3 className="mb-1 text-sm font-medium text-muted-foreground">Melhor criativo</h3>
        <p className="text-lg font-semibold text-card-foreground">{bestCreative.name}</p>
        <p className="mt-1 text-sm text-brand-success">{bestCreative.result}</p>
      </div>
    </div>
  );
}
