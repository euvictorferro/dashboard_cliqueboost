"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { Client } from "@/lib/clients";
import {
  ORGANIC_METRICS,
  getOrganicSnapshot,
  type DateRangeId,
  type OrganicMetricKey,
  type OrganicSnapshot,
} from "@/lib/metrics";
import { DateRangeFilter } from "./DateRangeFilter";
import { MetricCard } from "./MetricCard";
import { TrendChart } from "./TrendChart";
import { TopVideosList } from "./TopVideosList";
import { AdsPanel } from "./AdsPanel";
import { ExportPdfButton } from "./ExportPdfButton";

type Tab = "organic" | "ads";

const GROUPS: { title: string; keys: OrganicMetricKey[] }[] = [
  { title: "Audiência", keys: ["newFollowers", "lostFollowers", "reach"] },
  { title: "Engajamento", keys: ["comments", "likes", "saves", "shares"] },
];

function HeroSparkline({ data }: { data: { value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={64}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke="hsl(var(--brand-accent))" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Dashboard({ client, accessKey }: { client: Client; accessKey: string }) {
  const [range, setRange] = useState<DateRangeId>("30d");
  const [tab, setTab] = useState<Tab>("organic");
  const [chartMetric, setChartMetric] = useState<OrganicMetricKey>("reach");
  // ponytail: mock síncrono cobre o 1º render; o fetch troca por dado real (ou mock do servidor) assim que chega.
  const [snapshot, setSnapshot] = useState<OrganicSnapshot>(() => getOrganicSnapshot(client.id, range));
  const [snapshotKey, setSnapshotKey] = useState(`${client.id}:${range}`);
  const loading = snapshotKey !== `${client.id}:${range}`;

  useEffect(() => {
    let cancelled = false;
    const key = `${client.id}:${range}`;
    fetch(`/api/organic/${client.id}?range=${range}&key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      .then((data: OrganicSnapshot) => {
        if (cancelled) return;
        setSnapshot(data);
        setSnapshotKey(key);
      })
      .catch(() => {
        if (cancelled) return;
        setSnapshot(getOrganicSnapshot(client.id, range));
        setSnapshotKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [client.id, range, accessKey]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand-accent">Clique Boost</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl italic text-foreground">
            {client.name}
          </h1>
        </div>
        <ExportPdfButton />
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex w-fit gap-1 rounded-[var(--radius-card)] border border-border bg-card p-1">
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
        {tab === "organic" && (
          <div className="flex items-center gap-2">
            {loading && <span className="text-xs text-muted-foreground">Atualizando…</span>}
            <DateRangeFilter value={range} onChange={setRange} />
          </div>
        )}
      </div>

      {tab === "organic" ? (
        <div className="space-y-10">
          <section className="rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {ORGANIC_METRICS.netFollowers.label}
                </p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="font-[family-name:var(--font-display)] text-5xl text-card-foreground">
                    {snapshot.metrics.netFollowers.toLocaleString("pt-BR")}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      (snapshot.changePct.netFollowers ?? 0) >= 0 ? "text-brand-success" : "text-brand-danger"
                    }`}
                  >
                    {snapshot.changePct.netFollowers === null
                      ? "novo"
                      : `${snapshot.changePct.netFollowers >= 0 ? "▲" : "▼"} ${Math.abs(
                          snapshot.changePct.netFollowers
                        ).toFixed(1)}%`}
                  </span>
                </div>
              </div>
              <div className="w-40">
                <HeroSparkline data={snapshot.trend} />
              </div>
            </div>
          </section>

          {GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-sm italic text-muted-foreground">
                {group.title}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.keys.map((key) => (
                  <MetricCard
                    key={key}
                    label={ORGANIC_METRICS[key].label}
                    description={ORGANIC_METRICS[key].description}
                    value={snapshot.metrics[key].toLocaleString("pt-BR")}
                    changePct={snapshot.changePct[key]}
                    onClick={() => setChartMetric(key)}
                    active={chartMetric === key}
                  />
                ))}
              </div>
            </div>
          ))}

          <div>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-sm italic text-muted-foreground">
              Conteúdo
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                label={ORGANIC_METRICS.views.label}
                description={ORGANIC_METRICS.views.description}
                value={snapshot.metrics.views.toLocaleString("pt-BR")}
                changePct={snapshot.changePct.views}
                onClick={() => setChartMetric("views")}
                active={chartMetric === "views"}
              />
              <TopVideosList videos={snapshot.topVideos} />
            </div>
          </div>

          <TrendChart data={snapshot.trend} metricLabel={ORGANIC_METRICS[chartMetric].label} />
        </div>
      ) : (
        <AdsPanel clientId={client.id} active={client.adsActive} />
      )}
    </div>
  );
}
