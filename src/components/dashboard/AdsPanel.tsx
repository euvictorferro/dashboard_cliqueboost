"use client";

import { useEffect, useState } from "react";
import { ADS_METRICS, WHATSAPP_LINK, type AdsSnapshot, type AdsMetricKey } from "@/lib/ads";
import type { DateRangeId } from "@/lib/metrics";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ReachBarChart } from "@/components/dashboard/ReachBarChart";

type AdsResponse =
  | (AdsSnapshot & { active: true; currency: string })
  | { active: false; source?: string; errorMessage?: string };

function formatMetric(key: AdsMetricKey, value: number, currency: string): string {
  if (key === "roas") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;
  if (key === "clicks") return value.toLocaleString("pt-BR");
  return value.toLocaleString("pt-BR", { style: "currency", currency, maximumFractionDigits: 2 });
}

export function AdsPanel({ clientId, range }: { clientId: string; range: DateRangeId }) {
  const [data, setData] = useState<AdsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(`/api/ads/${clientId}?range=${range === "custom" ? "30d" : range}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${res.status}`))))
      .then((json) => !cancelled && setData(json))
      .catch(() => !cancelled && setData({ active: false }));
    return () => {
      cancelled = true;
    };
  }, [clientId, range]);

  // Carregando: mesmos cards, valores em "—", sem blur — evita flash da tela bloqueada.
  if (data === null) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.values(ADS_METRICS).map((m) => (
          <MetricCard key={m.label} label={m.label} description={m.description} value="—" />
        ))}
      </div>
    );
  }

  if (!data.active) {
    // ponytail: diagnóstico temporário — anúncio ligado manualmente no admin mas a Meta
    // rejeitou a chamada (token/permissão). Mostra o erro técnico em vez do CTA de vendas,
    // pra não confundir "sem token configurado" com "cliente sem anúncio". Remover quando
    // a detecção automática (hasActiveAds) estiver validada em produção.
    if (data.source === "error" && data.errorMessage) {
      return (
        <div className="rounded-[var(--radius-card)] bg-card p-6 text-center shadow-[var(--shadow-soft)]">
          <span className="text-2xl">⚠️</span>
          <p className="mt-2 text-base font-semibold text-card-foreground">
            Não foi possível carregar as métricas de anúncios
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            A Meta recusou a chamada — provavelmente falta permissão no token conectado.
          </p>
          <p className="mx-auto mt-3 max-w-md rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
            {data.errorMessage}
          </p>
        </div>
      );
    }

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

  const { metrics, spendTrend, clicksTrend, roasTrend, bestCreative, currency } = data;
  const fmt = (key: AdsMetricKey) => formatMetric(key, metrics[key], currency);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_1.6fr]">
        <MetricCard label={ADS_METRICS.cpa.label} description={ADS_METRICS.cpa.description} value={fmt("cpa")} />
        <MetricCard label={ADS_METRICS.cpc.label} description={ADS_METRICS.cpc.description} value={fmt("cpc")} />
        <MetricCard label={ADS_METRICS.cpm.label} description={ADS_METRICS.cpm.description} value={fmt("cpm")} />

        <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] lg:row-span-2">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">{ADS_METRICS.spend.label}</h3>
          <div className="h-56">
            <ReachBarChart data={spendTrend} />
          </div>
        </div>

        <MetricCard
          label={ADS_METRICS.clicks.label}
          description={ADS_METRICS.clicks.description}
          value={fmt("clicks")}
          sparkline={clicksTrend}
        />
        <MetricCard
          label={ADS_METRICS.roas.label}
          description={ADS_METRICS.roas.description}
          value={fmt("roas")}
          sparkline={roasTrend}
        />
        <MetricCard
          label={ADS_METRICS.cpr.label}
          description={ADS_METRICS.cpr.description}
          value={fmt("cpr")}
        />
      </div>

      {bestCreative.name !== "—" && (
        <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
          <h3 className="mb-1 text-sm font-medium text-muted-foreground">Melhor criativo</h3>
          <p className="text-lg font-semibold text-card-foreground">{bestCreative.name}</p>
          <p className="mt-1 text-sm text-brand-success">{bestCreative.result}</p>
        </div>
      )}
    </div>
  );
}
