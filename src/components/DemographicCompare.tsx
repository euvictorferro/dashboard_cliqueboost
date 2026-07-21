import type { DemographicSlice } from "@/lib/audience";

function Bars({ slices }: { slices: DemographicSlice[] }) {
  if (slices.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem dado suficiente.</p>;
  }
  return (
    <div className="space-y-2">
      {slices.map((s) => (
        <div key={s.key} className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{s.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-track">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent"
              style={{ width: `${Math.max(4, s.pct)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-medium text-card-foreground">{s.pct}%</span>
        </div>
      ))}
    </div>
  );
}

export function DemographicCompare({
  title,
  followers,
  engaged,
}: {
  title: string;
  followers: DemographicSlice[];
  engaged: DemographicSlice[];
}) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Seguidores</p>
          <Bars slices={followers} />
        </div>
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Engajados</p>
          <Bars slices={engaged} />
        </div>
      </div>
    </div>
  );
}
