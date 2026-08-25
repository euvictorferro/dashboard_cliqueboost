"use client";

import { useEffect, useState } from "react";
import type { Client } from "@/lib/clients";
import {
  ORGANIC_METRICS,
  getOrganicSnapshot,
  getOrganicWindowSnapshot,
  pctChange,
  type DateRangeId,
  type OrganicMetricKey,
  type OrganicSnapshot,
  type OrganicWindowSnapshot,
} from "@/lib/metrics";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import type { CompareWindows } from "@/components/dashboard/CompareRangePicker";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ReachBarChart } from "@/components/dashboard/ReachBarChart";
import { TopVideosList } from "@/components/dashboard/TopVideosList";
import { AdsPanel } from "@/components/dashboard/AdsPanel";
import { ExportPdfButton } from "@/components/dashboard/ExportPdfButton";
import { AudiencePanel } from "@/components/dashboard/AudiencePanel";

type Tab = "organic" | "ads";

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function Dashboard({ client }: { client: Client;  }) {
  const [range, setRange] = useState<DateRangeId>("30d");
  const [tab, setTab] = useState<Tab>("organic");
  // ponytail: mock síncrono cobre o 1º render; o fetch troca por dado real (ou mock do servidor) assim que chega.
  const [snapshot, setSnapshot] = useState<OrganicSnapshot>(() => getOrganicSnapshot(client.id, range));
  const [snapshotKey, setSnapshotKey] = useState(`${client.id}:${range}`);
  const loading = snapshotKey !== `${client.id}:${range}`;

  const [compareWindows, setCompareWindows] = useState<CompareWindows | null>(null);
  const [compareSnapshots, setCompareSnapshots] = useState<{ a: OrganicWindowSnapshot; b: OrganicWindowSnapshot } | null>(
    null
  );

  useEffect(() => {
    if (compareWindows) return; // modo comparação usa o efeito abaixo
    let cancelled = false;
    const key = `${client.id}:${range}`;
    fetch(`/api/organic/${client.id}?range=${range}`)
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
  }, [client.id, range, compareWindows]);

  useEffect(() => {
    if (!compareWindows) {
      setCompareSnapshots(null);
      return;
    }
    let cancelled = false;
    const fetchWindow = (w: { since: string; until: string }) =>
      fetch(`/api/organic/${client.id}?since=${w.since}&until=${w.until}`).then(
        (res) => res.json()
      );
    const windowDays = (w: { since: string; until: string }) =>
      Math.round((new Date(w.until).getTime() - new Date(w.since).getTime()) / 86400000);
    Promise.all([fetchWindow(compareWindows.a), fetchWindow(compareWindows.b)])
      .then(([a, b]: [OrganicWindowSnapshot, OrganicWindowSnapshot]) => {
        if (!cancelled) setCompareSnapshots({ a, b });
      })
      .catch(() => {
        // ponytail: mesma política de fallback do modo normal — se a busca real falhar
        // (rede, erro do servidor), cai pro mock em vez de travar em "Comparando…" pra sempre.
        if (cancelled) return;
        // ponytail: achado do review final — A e B têm sempre a mesma duração, então semear só
        // por dias faz as 2 janelas saírem idênticas no mock. Inclui o "since" de cada uma na
        // semente pra diferenciar, igual ao fallback equivalente na rota.
        setCompareSnapshots({
          a: getOrganicWindowSnapshot(`${client.id}-${compareWindows.a.since}`, windowDays(compareWindows.a)),
          b: getOrganicWindowSnapshot(`${client.id}-${compareWindows.b.since}`, windowDays(compareWindows.b)),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [client.id, compareWindows]);

  function handleRangeChange(id: DateRangeId) {
    setRange(id);
    if (id !== "custom") setCompareWindows(null);
  }

  function handleApplyCompare(windows: CompareWindows) {
    setRange("custom");
    setCompareWindows(windows);
  }

  const comparing = compareWindows !== null && compareSnapshots !== null;
  const m = comparing ? compareSnapshots!.a.metrics : snapshot.metrics;
  const c = snapshot.changePct;

  function compareProp(key: OrganicMetricKey, sparklineKey?: "trend" | "viewsTrend" | "likesTrend") {
    if (!comparing) return undefined;
    const { a, b } = compareSnapshots!;
    return {
      valueB: b.metrics[key].toLocaleString("pt-BR"),
      deltaPct: pctChange(a.metrics[key], b.metrics[key]),
      sparklineB: sparklineKey ? b[sparklineKey] : undefined,
    };
  }

  const activeTrend = comparing ? compareSnapshots!.a.trend : snapshot.trend;
  const activeTopPosts = comparing ? compareSnapshots!.a.topPosts : snapshot.topPosts;
  const activeReachBreakdown = comparing ? compareSnapshots!.a.reachBreakdown : snapshot.reachBreakdown;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 pt-6 pb-10 sm:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav data-tour="dashboard-tabs" className="flex w-fit gap-1 rounded-xl bg-card p-1 shadow-[var(--shadow-soft)]">
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
        <div className="flex items-center gap-2">
          {tab === "organic" && !compareWindows && loading && <span className="text-xs text-muted-foreground">Atualizando…</span>}
          {tab === "organic" && compareWindows && !compareSnapshots && <span className="text-xs text-muted-foreground">Comparando…</span>}
          {tab === "organic" && (
            <DateRangeFilter value={range} onChange={handleRangeChange} onApplyCompare={handleApplyCompare} />
          )}
          <ExportPdfButton clientId={client.id} range={range} disabled={compareWindows !== null} />
        </div>
      </div>

      {tab === "organic" && compareWindows && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-card px-4 py-2.5 text-xs shadow-[var(--shadow-soft)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-primary" aria-hidden="true" />
            <span className="text-muted-foreground">Período A:</span>
            <span className="font-medium text-card-foreground">
              {formatDateBR(compareWindows.a.since)} – {formatDateBR(compareWindows.a.until)}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-accent" aria-hidden="true" />
            <span className="text-muted-foreground">Período B:</span>
            <span className="font-medium text-card-foreground">
              {formatDateBR(compareWindows.b.since)} – {formatDateBR(compareWindows.b.until)}
            </span>
          </span>
        </div>
      )}

      {tab === "organic" && (
        <div className="space-y-6">
          <div data-tour="dashboard-metrics" className="grid grid-cols-1 gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_1.6fr]">
            <MetricCard
              label={ORGANIC_METRICS.newFollowers.label}
              description={ORGANIC_METRICS.newFollowers.description}
              value={m.newFollowers.toLocaleString("pt-BR")}
              compare={compareProp("newFollowers")}
            />
            <MetricCard
              label={ORGANIC_METRICS.lostFollowers.label}
              description={ORGANIC_METRICS.lostFollowers.description}
              value={m.lostFollowers.toLocaleString("pt-BR")}
              compare={compareProp("lostFollowers")}
            />
            <MetricCard
              label={ORGANIC_METRICS.netFollowers.label}
              description={ORGANIC_METRICS.netFollowers.description}
              value={m.netFollowers.toLocaleString("pt-BR")}
              compare={compareProp("netFollowers")}
            />

            <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)] lg:row-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Alcance</h3>
                {comparing && (
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-brand-primary" aria-hidden="true" /> A
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-brand-accent" aria-hidden="true" /> B
                    </span>
                  </div>
                )}
              </div>
              <div className="h-56">
                <ReachBarChart data={activeTrend} dataB={comparing ? compareSnapshots!.b.trend : undefined} />
              </div>
            </div>

            <MetricCard
              label={ORGANIC_METRICS.reach.label}
              description={ORGANIC_METRICS.reach.description}
              value={m.reach.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.reach}
              sparkline={activeTrend}
              compare={compareProp("reach", "trend")}
            />
            <MetricCard
              label={ORGANIC_METRICS.views.label}
              description={ORGANIC_METRICS.views.description}
              value={m.views.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.views}
              sparkline={comparing ? compareSnapshots!.a.viewsTrend : snapshot.viewsTrend}
              compare={compareProp("views", "viewsTrend")}
            />
            <MetricCard
              label={ORGANIC_METRICS.likes.label}
              description={ORGANIC_METRICS.likes.description}
              value={m.likes.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.likes}
              sparkline={comparing ? compareSnapshots!.a.likesTrend : snapshot.likesTrend}
              compare={compareProp("likes", "likesTrend")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <MetricCard
              label={ORGANIC_METRICS.comments.label}
              description={ORGANIC_METRICS.comments.description}
              value={m.comments.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.comments}
              compare={compareProp("comments")}
            />
            <MetricCard
              label={ORGANIC_METRICS.saves.label}
              description={ORGANIC_METRICS.saves.description}
              value={m.saves.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.saves}
              compare={compareProp("saves")}
            />
            <MetricCard
              label={ORGANIC_METRICS.shares.label}
              description={ORGANIC_METRICS.shares.description}
              value={m.shares.toLocaleString("pt-BR")}
              changePct={comparing ? undefined : c.shares}
              compare={compareProp("shares")}
            />
          </div>

          <TopVideosList posts={activeTopPosts} />

          <AudiencePanel clientId={client.id} reachBreakdown={activeReachBreakdown} />
        </div>
      )}
      {tab === "ads" && <AdsPanel clientId={client.id} range={range} />}
    </div>
  );
}
