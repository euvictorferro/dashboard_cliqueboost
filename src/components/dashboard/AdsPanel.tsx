"use client";

import { useEffect, useState } from "react";
import { ADS_METRICS, WHATSAPP_LINK, type AdsSnapshot, type AdsMetricKey, type AdsCreative } from "@/lib/ads";
import type { DateRangeId } from "@/lib/metrics";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ReachBarChart } from "@/components/dashboard/ReachBarChart";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

type AdsResponse =
  | (AdsSnapshot & { active: true; currency: string })
  | { active: false; source?: string; errorMessage?: string };

function formatMetric(key: AdsMetricKey, value: number, currency: string): string {
  if (key === "roas") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;
  if (key === "clicks" || key === "results") return value.toLocaleString("pt-BR");
  return value.toLocaleString("pt-BR", { style: "currency", currency, maximumFractionDigits: 2 });
}

function formatMoney(value: number, currency: string): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency, maximumFractionDigits: 2 });
}

const MAIN_METRICS: AdsMetricKey[] = ["cpa", "clicks", "cpc", "cpm", "roas", "cpr"];

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Object.values(ADS_METRICS).map((m) => (
        <MetricCard key={m.label} label={m.label} description={m.description} value="—" />
      ))}
    </div>
  );
}

function LockedPanel() {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)]">
      <div className="pointer-events-none grid grid-cols-2 gap-3 p-4 blur-sm sm:grid-cols-4">
        {Object.values(ADS_METRICS).map((m) => (
          <MetricCard key={m.label} label={m.label} description={m.description} value="—" />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 px-6 text-center">
        <span className="text-2xl">🔒</span>
        <p className="text-base font-semibold text-card-foreground">Você não tem anúncios ativos no momento</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Essa tela é exclusiva para ver as métricas de ADS. Se quiser começar a rodar tráfego pago
          para seu negócio, fale com nossa equipe.
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

// Funil de conversão: alcance -> cliques no link -> resultados, com o % de queda entre etapas.
function ConversionFunnel({ reach, clicks, results }: { reach: number; clicks: number; results: number }) {
  const stages = [
    { label: "Alcance", value: reach },
    { label: "Cliques no link", value: clicks },
    { label: "Resultados", value: results },
  ];
  const max = stages[0].value || 1;

  return (
    <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>Funil de conversão</span>
        <InfoTooltip text="Mostra quantas pessoas foram alcançadas, quantas clicaram no link e quantas viraram resultado (lead, venda ou conversa) no período." />
      </div>
      <div className="space-y-3">
        {stages.map((stage, i) => {
          const prev = i > 0 ? stages[i - 1].value : null;
          const dropPct = prev && prev > 0 ? (stage.value / prev) * 100 : null;
          const widthPct = Math.max((stage.value / max) * 100, stage.value > 0 ? 4 : 0);
          return (
            <div key={stage.label}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium text-card-foreground">{stage.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {stage.value.toLocaleString("pt-BR")}
                  {dropPct !== null && <span className="ml-2 text-xs">({dropPct.toFixed(1)}%)</span>}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-primary transition-all"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Lista de criativos ordenada por desempenho — o primeiro (melhor) ganha destaque visual.
// Com um único criativo rodando, mostra ele sozinho já destacado.
function CreativesList({ creatives, currency }: { creatives: AdsCreative[]; currency: string }) {
  if (creatives.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Criativos</h3>
      <div className="space-y-3">
        {creatives.map((c, i) => (
          <div
            key={c.name + i}
            className={`rounded-[var(--radius-card)] border p-4 ${
              i === 0 ? "border-brand-primary bg-brand-primary/5" : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-card-foreground">{c.name}</p>
              {i === 0 && (
                <span className="rounded-full bg-brand-primary px-2 py-0.5 text-xs font-medium text-white">
                  Melhor desempenho
                </span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
              <span>Investimento: <span className="font-medium text-card-foreground">{formatMoney(c.spend, currency)}</span></span>
              <span>Resultados: <span className="font-medium text-card-foreground">{c.results.toLocaleString("pt-BR")}</span></span>
              <span>CPA: <span className="font-medium text-card-foreground">{c.results > 0 ? formatMoney(c.cpa, currency) : "—"}</span></span>
              <span>CTR: <span className="font-medium text-card-foreground">{c.ctr.toFixed(1)}%</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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

  if (data === null) return <LoadingGrid />;

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
    return <LockedPanel />;
  }

  const { metrics, reach, impressions, remainingBudget, spendTrend, creatives, currency } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label={ADS_METRICS.spend.label} description={ADS_METRICS.spend.description} value={formatMoney(metrics.spend, currency)} />
        {remainingBudget !== null && (
          <MetricCard
            label="Saldo disponível"
            description="Orçamento restante até o teto de gasto configurado nessa conta de anúncios."
            value={formatMoney(remainingBudget, currency)}
          />
        )}
        {MAIN_METRICS.map((key) => (
          <MetricCard
            key={key}
            label={ADS_METRICS[key].label}
            description={ADS_METRICS[key].description}
            value={formatMetric(key, metrics[key], currency)}
          />
        ))}
      </div>

      <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-sm font-medium text-muted-foreground">{ADS_METRICS.spend.label} por dia</h3>
          <div className="flex gap-6 text-sm">
            <span className="text-muted-foreground">
              Alcance <span className="font-semibold text-card-foreground">{reach.toLocaleString("pt-BR")}</span>
            </span>
            <span className="text-muted-foreground">
              Impressões <span className="font-semibold text-card-foreground">{impressions.toLocaleString("pt-BR")}</span>
            </span>
          </div>
        </div>
        <div className="h-56">
          <ReachBarChart data={spendTrend} />
        </div>
      </div>

      <ConversionFunnel reach={reach} clicks={metrics.clicks} results={metrics.results} />

      <CreativesList creatives={creatives} currency={currency} />
    </div>
  );
}
