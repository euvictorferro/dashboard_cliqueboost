"use client";

import { useMemo, useState } from "react";
import { CLIENTS } from "@/lib/clients";
import { ORGANIC_METRICS, getOrganicSnapshot, type DateRangeId, type OrganicMetricKey } from "@/lib/metrics";
import { ClientSelector } from "./ClientSelector";
import { DateRangeFilter } from "./DateRangeFilter";
import { MetricCard } from "./MetricCard";
import { TrendChart } from "./TrendChart";
import { TopVideosList } from "./TopVideosList";
import { AdsPanel } from "./AdsPanel";
import { ExportPdfButton } from "./ExportPdfButton";

type Tab = "organic" | "ads";

export function Dashboard() {
  const [clientId, setClientId] = useState(CLIENTS[0].id);
  const [range, setRange] = useState<DateRangeId>("30d");
  const [tab, setTab] = useState<Tab>("organic");
  const [chartMetric, setChartMetric] = useState<OrganicMetricKey>("reach");

  const client = CLIENTS.find((c) => c.id === clientId)!;
  const snapshot = useMemo(() => getOrganicSnapshot(clientId, range), [clientId, range]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-accent">Clique Boost</p>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard — {client.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ClientSelector value={clientId} onChange={setClientId} />
          <ExportPdfButton />
        </div>
      </header>

      <nav className="mb-6 flex gap-1 rounded-[var(--radius-card)] border border-border bg-card p-1 w-fit">
        {([
          ["organic", "Orgânico"],
          ["ads", "Ads"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === id ? "bg-brand-primary text-white" : "text-muted-foreground hover:text-card-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "organic" ? (
        <div className="space-y-6">
          <DateRangeFilter value={range} onChange={setRange} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(Object.keys(ORGANIC_METRICS) as OrganicMetricKey[]).map((key) => (
              <button key={key} onClick={() => setChartMetric(key)} className="text-left">
                <MetricCard
                  label={ORGANIC_METRICS[key].label}
                  description={ORGANIC_METRICS[key].description}
                  value={snapshot.metrics[key].toLocaleString("pt-BR")}
                />
              </button>
            ))}
          </div>

          <TrendChart data={snapshot.trend} metricLabel={ORGANIC_METRICS[chartMetric].label} />

          <TopVideosList videos={snapshot.topVideos} />
        </div>
      ) : (
        <AdsPanel clientId={clientId} active={client.adsActive} />
      )}
    </div>
  );
}
