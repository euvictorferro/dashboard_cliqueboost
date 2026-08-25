"use client";

import { useEffect, useState } from "react";
import { ADS_METRICS, WHATSAPP_LINK, type AdsSnapshot, type AdsMetricKey, type AdsCreative } from "@/lib/ads";
import type { DateRangeId } from "@/lib/metrics";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ReachBarChart } from "@/components/dashboard/ReachBarChart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CreativePreviewModal } from "@/components/dashboard/CreativePreviewModal";
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

// 8 cards no total com "spend" (renderizado à parte) — fecha 2 linhas cheias de 4 no grid,
// sem sobrar buraco. Se adicionar/remover uma métrica aqui, ajuste em par pra manter simétrico.
const MAIN_METRICS: AdsMetricKey[] = ["results", "cpa", "clicks", "cpc", "cpm", "roas", "cpr"];

function ToggleGroup<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-muted p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            value === opt.id ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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

// Funil de conversão em formato de trapézio de verdade: cada etapa mais estreita que a
// anterior, na proporção real dos valores (não só uma barra horizontal).
function FunnelShape({ stages }: { stages: { label: string; value: number }[] }) {
  const max = Math.max(1, stages[0]?.value ?? 1);
  const widthPct = (v: number) => Math.max(14, (v / max) * 100);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-2">
      {stages.map((stage, i) => {
        const top = widthPct(stage.value);
        const bottom = i < stages.length - 1 ? widthPct(stages[i + 1].value) : top;
        const leftTop = (100 - top) / 2;
        const leftBottom = (100 - bottom) / 2;
        const clipPath = `polygon(${leftTop}% 0, ${100 - leftTop}% 0, ${100 - leftBottom}% 100%, ${leftBottom}% 100%)`;
        const prev = i > 0 ? stages[i - 1].value : null;
        const dropPct = prev && prev > 0 ? (stage.value / prev) * 100 : null;

        return (
          <div key={stage.label} className="w-full">
            <div
              className="mx-auto flex h-14 w-full items-center justify-center text-center text-white"
              style={{ clipPath, background: `hsl(var(--brand-primary) / ${1 - i * 0.22})` }}
            >
              <div className="pointer-events-none px-2">
                <p className="text-sm font-semibold leading-tight">{stage.value.toLocaleString("pt-BR")}</p>
              </div>
            </div>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {stage.label}
              {dropPct !== null && <span className="ml-1">({dropPct.toFixed(1)}%)</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}

const FUNNEL_HEIGHT_PX = 244; // altura real do FunnelShape (3 etapas + legendas) — a pizza usa a mesma, pra não encolher o bloco ao trocar de visualização.
const PIE_COLORS = ["hsl(var(--brand-primary))", "hsl(var(--brand-accent))", "hsl(var(--brand-success))"];

function FunnelPie({ stages }: { stages: { label: string; value: number }[] }) {
  return (
    <div className="flex w-full items-center gap-6" style={{ height: FUNNEL_HEIGHT_PX }}>
      <div className="h-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={stages} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={2}>
              {stages.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="shrink-0 space-y-2">
        {stages.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium text-card-foreground">{s.value.toLocaleString("pt-BR")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConversionFunnel({ reach, clicks, results }: { reach: number; clicks: number; results: number }) {
  const [view, setView] = useState<"funnel" | "pizza">("funnel");
  const stages = [
    { label: "Alcance", value: reach },
    { label: "Cliques no link", value: clicks },
    { label: "Resultados", value: results },
  ];

  return (
    <div className="flex h-full flex-col rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Funil de conversão</span>
          <InfoTooltip text="Mostra quantas pessoas foram alcançadas, quantas clicaram no link e quantas viraram resultado (lead, venda ou conversa) no período." />
        </div>
        <ToggleGroup
          options={[
            { id: "funnel", label: "Funil" },
            { id: "pizza", label: "Pizza" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      <div className="flex flex-1 items-center">
        {view === "funnel" ? <FunnelShape stages={stages} /> : <FunnelPie stages={stages} />}
      </div>
    </div>
  );
}

// Lista de criativos ordenada por desempenho — o primeiro (melhor) ganha destaque visual.
// Clicar em um abre o preview (imagem do anúncio + métricas). Com um único criativo rodando,
// mostra ele sozinho já destacado.
function CreativesList({ creatives, currency, onSelect }: { creatives: AdsCreative[]; currency: string; onSelect: (c: AdsCreative) => void }) {
  if (creatives.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Criativos</h3>
      <div className="space-y-3">
        {creatives.map((c, i) => (
          <button
            key={c.name + i}
            onClick={() => onSelect(c)}
            className={`w-full rounded-[var(--radius-card)] border p-4 text-left transition-colors hover:bg-muted/50 ${
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
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdsPanel({ clientId, range }: { clientId: string; range: DateRangeId }) {
  const [data, setData] = useState<AdsResponse | null>(null);
  const [chartMode, setChartMode] = useState<"bar" | "line">("bar");
  const [selectedCreative, setSelectedCreative] = useState<AdsCreative | null>(null);

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

  const { metrics, reach, impressions, spendTrend, creatives, currency } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label={ADS_METRICS.spend.label} description={ADS_METRICS.spend.description} value={formatMoney(metrics.spend, currency)} />
        {MAIN_METRICS.map((key) => (
          <MetricCard
            key={key}
            label={ADS_METRICS[key].label}
            description={ADS_METRICS[key].description}
            value={formatMetric(key, metrics[key], currency)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">{ADS_METRICS.spend.label} por dia</h3>
              <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                <span>Alcance <span className="font-semibold text-card-foreground">{reach.toLocaleString("pt-BR")}</span></span>
                <span>Impressões <span className="font-semibold text-card-foreground">{impressions.toLocaleString("pt-BR")}</span></span>
              </div>
            </div>
            <ToggleGroup
              options={[
                { id: "bar", label: "Barra" },
                { id: "line", label: "Linha" },
              ]}
              value={chartMode}
              onChange={setChartMode}
            />
          </div>
          <div className="h-48 flex-1">
            <ReachBarChart data={spendTrend} mode={chartMode} />
          </div>
        </div>

        <ConversionFunnel reach={reach} clicks={metrics.clicks} results={metrics.results} />
      </div>

      <CreativesList creatives={creatives} currency={currency} onSelect={setSelectedCreative} />

      {selectedCreative && (
        <CreativePreviewModal creative={selectedCreative} currency={currency} onClose={() => setSelectedCreative(null)} />
      )}
    </div>
  );
}
