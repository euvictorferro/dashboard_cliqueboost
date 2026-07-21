import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import type { DemographicSlice } from "@/lib/audience";

const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

function sortByAge(slices: DemographicSlice[]): DemographicSlice[] {
  return AGE_ORDER.map((bracket) => slices.find((s) => s.key === bracket)).filter(
    (s): s is DemographicSlice => Boolean(s)
  );
}

export function AgeBarChart({ label, slices }: { label: string; slices: DemographicSlice[] }) {
  const data = sortByAge(slices);

  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="key" fontSize={10} stroke="hsl(var(--muted-foreground))" />
            <YAxis hide />
            <Bar dataKey="pct" fill="hsl(var(--brand-primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
