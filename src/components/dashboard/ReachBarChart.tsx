import { LineChart, Line, ResponsiveContainer } from "recharts";

export function ReachBarChart({
  data,
  dataB,
  mode = "bar",
}: {
  data: { date: string; value: number }[];
  dataB?: { date: string; value: number }[];
  mode?: "bar" | "line";
}) {
  if (mode === "line" && !dataB) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="value" stroke="hsl(var(--brand-accent))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (dataB) {
    // ponytail: mesma garantia de tamanho igual do MetricCard — CompareRangePicker força A e B
    // a terem a mesma duração.
    const merged = data.map((d, i) => ({ date: d.date, a: d.value, b: dataB[i]?.value ?? null }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="a" stroke="hsl(var(--brand-primary))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="b" stroke="hsl(var(--brand-accent))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 gap-[3px]">
        {data.map((d, i) => (
          <div key={i} className="group relative flex flex-1 justify-center">
            <div className="relative h-full w-full max-w-3 rounded-full bg-brand-track">
              <div
                className="absolute bottom-0 w-full rounded-full bg-brand-accent transition-all"
                style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
              />
            </div>
            {/* ponytail: cor fixa, não bg-foreground/text-background — esses tokens invertem no
                dark mode (mesmo bug já corrigido no InfoTooltip). */}
            <div className="pointer-events-none absolute bottom-full mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-neutral-100 group-hover:block">
              {d.value.toLocaleString("pt-BR")}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[3px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-muted-foreground">
            {i % Math.ceil(data.length / 8 || 1) === 0 ? d.date : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
