"use client";

import { useEffect, useState } from "react";
import { getAudienceSnapshot, type AudienceSnapshot, type AudienceTimeframeId } from "@/lib/audience";
import type { ReachBreakdown } from "@/lib/metrics";
import { AudienceTimeframeFilter } from "./AudienceTimeframeFilter";
import { DemographicCompare } from "./DemographicCompare";

function ReachBreakdownCard({ breakdown }: { breakdown: ReachBreakdown }) {
  const followTotal = breakdown.byFollowType.follower + breakdown.byFollowType.nonFollower + breakdown.byFollowType.unknown;
  const mediaTotal =
    breakdown.byMediaType.post + breakdown.byMediaType.story + breakdown.byMediaType.reel + breakdown.byMediaType.ad;
  const pct = (value: number, total: number) => (total === 0 ? 0 : Math.round((value / total) * 100));

  return (
    <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        Alcance por origem e tipo de conteúdo (período principal do dashboard)
      </h3>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Seguidor vs. não-seguidor
          </p>
          <p className="text-sm text-card-foreground">Seguidores: {pct(breakdown.byFollowType.follower, followTotal)}%</p>
          <p className="text-sm text-card-foreground">
            Não-seguidores: {pct(breakdown.byFollowType.nonFollower, followTotal)}%
          </p>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tipo de conteúdo</p>
          <p className="text-sm text-card-foreground">Posts: {pct(breakdown.byMediaType.post, mediaTotal)}%</p>
          <p className="text-sm text-card-foreground">Stories: {pct(breakdown.byMediaType.story, mediaTotal)}%</p>
          <p className="text-sm text-card-foreground">Reels: {pct(breakdown.byMediaType.reel, mediaTotal)}%</p>
          <p className="text-sm text-card-foreground">Anúncios: {pct(breakdown.byMediaType.ad, mediaTotal)}%</p>
        </div>
      </div>
    </div>
  );
}

export function AudiencePanel({
  clientId,
  accessKey,
  reachBreakdown,
}: {
  clientId: string;
  accessKey: string;
  reachBreakdown?: ReachBreakdown;
}) {
  const [timeframe, setTimeframe] = useState<AudienceTimeframeId>("last_30_days");
  const [snapshot, setSnapshot] = useState<AudienceSnapshot>(() => getAudienceSnapshot(clientId, timeframe));

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/audience/${clientId}?timeframe=${timeframe}&key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      .then((data: AudienceSnapshot) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(getAudienceSnapshot(clientId, timeframe));
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, timeframe, accessKey]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AudienceTimeframeFilter value={timeframe} onChange={setTimeframe} />
      </div>

      {!snapshot.hasEnoughData ? (
        <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-muted-foreground">Ainda não temos dados suficientes sobre esse público.</p>
        </div>
      ) : (
        <>
          <DemographicCompare title="Gênero" followers={snapshot.followers.gender} engaged={snapshot.engaged.gender} />
          <DemographicCompare title="Idade" followers={snapshot.followers.age} engaged={snapshot.engaged.age} />
          <DemographicCompare title="Países" followers={snapshot.followers.country} engaged={snapshot.engaged.country} />
          <DemographicCompare title="Cidades" followers={snapshot.followers.city} engaged={snapshot.engaged.city} />
        </>
      )}

      {reachBreakdown && <ReachBreakdownCard breakdown={reachBreakdown} />}
    </div>
  );
}
