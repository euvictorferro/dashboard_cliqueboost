import { LineChart, Line, ResponsiveContainer } from "recharts";

function Sparkline({ data }: { data: { value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Line type="monotone" dataKey="value" stroke="hsl(var(--brand-accent))" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs font-medium text-muted-foreground">novo</span>;
  }
  const isUp = pct >= 0;
  return (
    <span className={`text-xs font-medium tabular-nums ${isUp ? "text-brand-success" : "text-brand-danger"}`}>
      {isUp ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function MetricCard({
  label,
  description,
  value,
  changePct,
  sparkline,
}: {
  label: string;
  description: string;
  value: string;
  changePct?: number | null;
  sparkline?: { value: number }[];
}) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{label}</span>
        <span className="group relative inline-flex">
          <span className="flex h-4 w-4 cursor-default items-center justify-center rounded-full border border-muted-foreground/50 text-[10px] leading-none">
            i
          </span>
          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            {description}
          </span>
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-card-foreground">{value}</p>
        {changePct !== undefined && <ChangeBadge pct={changePct} />}
      </div>
      {sparkline && <div className="mt-2">
        <Sparkline data={sparkline} />
      </div>}
    </div>
  );
}
