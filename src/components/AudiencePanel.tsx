"use client";

import { useEffect, useState } from "react";
import { getAudienceSnapshot, type AudienceSnapshot, type AudienceTimeframeId } from "@/lib/audience";
import type { ReachBreakdown } from "@/lib/metrics";
import { AudienceTimeframeFilter } from "./AudienceTimeframeFilter";
import { SlicePieChart } from "./SlicePieChart";
import { AgeBarChart } from "./AgeBarChart";
import { GeoRankList } from "./GeoRankList";

function AudienceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function TwoColumn({
  showEngaged,
  followers,
  engaged,
}: {
  showEngaged: boolean;
  followers: React.ReactNode;
  engaged: React.ReactNode;
}) {
  return (
    <div className={showEngaged ? "grid grid-cols-1 gap-6 sm:grid-cols-2" : ""}>
      {followers}
      {showEngaged && engaged}
    </div>
  );
}

function ReachBreakdownCard({ breakdown }: { breakdown: ReachBreakdown }) {
  const followData = [
    { name: "Seguidores", value: breakdown.byFollowType.follower },
    { name: "Não-seguidores", value: breakdown.byFollowType.nonFollower },
  ];
  const mediaData = [
    { name: "Posts", value: breakdown.byMediaType.post },
    { name: "Stories", value: breakdown.byMediaType.story },
    { name: "Reels", value: breakdown.byMediaType.reel },
    { name: "Anúncios", value: breakdown.byMediaType.ad },
  ];

  return (
    <AudienceCard title="Alcance por origem e tipo de conteúdo (período principal do dashboard)">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SlicePieChart label="Seguidor vs. não-seguidor" data={followData} />
        <SlicePieChart label="Tipo de conteúdo" data={mediaData} />
      </div>
    </AudienceCard>
  );
}

function hasAnyData(set: AudienceSnapshot["followers"]): boolean {
  return set.gender.length > 0 || set.age.length > 0 || set.country.length > 0 || set.city.length > 0;
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
  const [timeframe, setTimeframe] = useState<AudienceTimeframeId>("this_month");
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

  const engagedHasData = hasAnyData(snapshot.engaged);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Público</h2>
        <AudienceTimeframeFilter value={timeframe} onChange={setTimeframe} />
      </div>

      {!snapshot.hasEnoughData ? (
        <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-muted-foreground">Ainda não temos dados suficientes sobre esse público.</p>
        </div>
      ) : (
        <>
          {!engagedHasData && (
            <p className="text-xs text-muted-foreground">
              Ainda não temos engajamento suficiente no período pra mostrar a demografia de quem interagiu — só
              seguidores por enquanto.
            </p>
          )}

          <AudienceCard title="Gênero">
            <TwoColumn
              showEngaged={engagedHasData}
              followers={
                <SlicePieChart
                  label="Seguidores"
                  data={snapshot.followers.gender.map((s) => ({ name: s.label, value: s.pct }))}
                />
              }
              engaged={
                <SlicePieChart
                  label="Engajados"
                  data={snapshot.engaged.gender.map((s) => ({ name: s.label, value: s.pct }))}
                />
              }
            />
          </AudienceCard>

          <AudienceCard title="Idade">
            <TwoColumn
              showEngaged={engagedHasData}
              followers={<AgeBarChart label="Seguidores" slices={snapshot.followers.age} />}
              engaged={<AgeBarChart label="Engajados" slices={snapshot.engaged.age} />}
            />
          </AudienceCard>

          <AudienceCard title="Países">
            <TwoColumn
              showEngaged={engagedHasData}
              followers={<GeoRankList label="Seguidores" slices={snapshot.followers.country} showFlag />}
              engaged={<GeoRankList label="Engajados" slices={snapshot.engaged.country} showFlag />}
            />
          </AudienceCard>

          <AudienceCard title="Cidades">
            <TwoColumn
              showEngaged={engagedHasData}
              followers={<GeoRankList label="Seguidores" slices={snapshot.followers.city} />}
              engaged={<GeoRankList label="Engajados" slices={snapshot.engaged.city} />}
            />
          </AudienceCard>
        </>
      )}

      {reachBreakdown && <ReachBreakdownCard breakdown={reachBreakdown} />}
    </div>
  );
}
