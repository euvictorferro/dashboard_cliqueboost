import { LineChart, Line, ResponsiveContainer } from "recharts";
import { InfoTooltip } from "./InfoTooltip";

function Sparkline({ data, dataB }: { data: { value: number }[]; dataB?: { value: number }[] }) {
  if (!dataB) {
    return (
      <ResponsiveContainer width="100%" height={32}>
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="value" stroke="hsl(var(--brand-accent))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ponytail: as 2 séries sempre têm o mesmo tamanho aqui — CompareRangePicker força Período B
  // a ter a mesma duração de A, então alinhar por índice (i) é seguro.
  const merged = data.map((d, i) => ({ a: d.value, b: dataB[i]?.value ?? null }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={merged} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Line type="monotone" dataKey="a" stroke="hsl(var(--brand-primary))" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="b" stroke="hsl(var(--brand-accent))" strokeWidth={2} dot={false} />
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
  compare,
}: {
  label: string;
  description: string;
  value: string;
  changePct?: number | null;
  sparkline?: { value: number }[];
  compare?: { valueB: string; deltaPct: number | null; sparklineB?: { value: number }[] };
}) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{label}</span>
        <InfoTooltip text={description} />
      </div>

      {compare ? (
        <>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand-primary" aria-hidden="true" />
            <p className="text-lg font-semibold text-card-foreground">{value}</p>
            <span className="text-xs text-muted-foreground">vs.</span>
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand-accent" aria-hidden="true" />
            <p className="text-lg font-semibold text-card-foreground">{compare.valueB}</p>
            <ChangeBadge pct={compare.deltaPct} />
          </div>
          {sparkline && (
            <div className="mt-2">
              <Sparkline data={sparkline} dataB={compare.sparklineB} />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-card-foreground">{value}</p>
            {changePct !== undefined && <ChangeBadge pct={changePct} />}
          </div>
          {sparkline && (
            <div className="mt-2">
              <Sparkline data={sparkline} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
