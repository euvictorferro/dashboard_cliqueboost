import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const PALETTE = ["#7c3aed", "#0080ff", "#00c896", "#ff5c4d", "#8b5cf6", "#c4b5fd"];

export function SlicePieChart({ label, data }: { label: string; data: { name: string; value: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={22} outerRadius={44} paddingAngle={1}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1.5">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-1.5 text-xs text-card-foreground">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-medium">{total === 0 ? 0 : Math.round((d.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
