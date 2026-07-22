import { LineChart, Line, ResponsiveContainer } from "recharts";
import { InfoTooltip } from "./InfoTooltip";

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
        <InfoTooltip text={description} />
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
