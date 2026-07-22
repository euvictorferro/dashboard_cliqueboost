"use client";

import { useEffect, useState } from "react";
import type { Client } from "@/lib/clients";
import { ORGANIC_METRICS, getOrganicSnapshot, type DateRangeId, type OrganicSnapshot } from "@/lib/metrics";
import { DateRangeFilter } from "./DateRangeFilter";
import { MetricCard } from "./MetricCard";
import { ReachBarChart } from "./ReachBarChart";
import { TopVideosList } from "./TopVideosList";
import { AdsPanel } from "./AdsPanel";
import { ExportPdfButton } from "./ExportPdfButton";
import { Logo } from "./Logo";
import { AudiencePanel } from "./AudiencePanel";

type Tab = "organic" | "ads";

export function Dashboard({ client, accessKey }: { client: Client; accessKey: string }) {
  const [range, setRange] = useState<DateRangeId>("30d");
  const [tab, setTab] = useState<Tab>("organic");
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

  const m = snapshot.metrics;
  const c = snapshot.changePct;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Logo />
          <h1 className="mt-2 text-2xl font-bold text-foreground">{client.name}</h1>
        </div>
        <ExportPdfButton clientId={client.id} range={range} accessKey={accessKey} />
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex w-fit gap-1 rounded-xl bg-card p-1 shadow-[var(--shadow-soft)]">
          {([
            ["organic", "Orgânico"],
            ["ads", "Ads"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
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

      {tab === "organic" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_1.6fr]">
            <MetricCard
              label={ORGANIC_METRICS.newFollowers.label}
              description={ORGANIC_METRICS.newFollowers.description}
              value={m.newFollowers.toLocaleString("pt-BR")}
            />
            <MetricCard
              label={ORGANIC_METRICS.lostFollowers.label}
              description={ORGANIC_METRICS.lostFollowers.description}
              value={m.lostFollowers.toLocaleString("pt-BR")}
            />
            <MetricCard
              label={ORGANIC_METRICS.netFollowers.label}
              description={ORGANIC_METRICS.netFollowers.description}
              value={m.netFollowers.toLocaleString("pt-BR")}
            />

            <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] lg:row-span-2">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">Alcance</h3>
              <div className="h-56">
                <ReachBarChart data={snapshot.trend} />
              </div>
            </div>

            <MetricCard
              label={ORGANIC_METRICS.reach.label}
              description={ORGANIC_METRICS.reach.description}
              value={m.reach.toLocaleString("pt-BR")}
              changePct={c.reach}
              sparkline={snapshot.trend}
            />
            <MetricCard
              label={ORGANIC_METRICS.views.label}
              description={ORGANIC_METRICS.views.description}
              value={m.views.toLocaleString("pt-BR")}
              changePct={c.views}
              sparkline={snapshot.viewsTrend}
            />
            <MetricCard
              label={ORGANIC_METRICS.likes.label}
              description={ORGANIC_METRICS.likes.description}
              value={m.likes.toLocaleString("pt-BR")}
              changePct={c.likes}
              sparkline={snapshot.likesTrend}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <MetricCard
              label={ORGANIC_METRICS.comments.label}
              description={ORGANIC_METRICS.comments.description}
              value={m.comments.toLocaleString("pt-BR")}
              changePct={c.comments}
            />
            <MetricCard
              label={ORGANIC_METRICS.saves.label}
              description={ORGANIC_METRICS.saves.description}
              value={m.saves.toLocaleString("pt-BR")}
              changePct={c.saves}
            />
            <MetricCard
              label={ORGANIC_METRICS.shares.label}
              description={ORGANIC_METRICS.shares.description}
              value={m.shares.toLocaleString("pt-BR")}
              changePct={c.shares}
            />
          </div>

          <TopVideosList posts={snapshot.topPosts} />

          <AudiencePanel clientId={client.id} accessKey={accessKey} reachBreakdown={snapshot.reachBreakdown} />
        </div>
      )}
      {tab === "ads" && <AdsPanel clientId={client.id} active={client.adsActive} />}
    </div>
  );
}
