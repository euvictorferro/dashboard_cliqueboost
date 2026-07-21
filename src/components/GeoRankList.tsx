import type { DemographicSlice } from "@/lib/audience";
import { countryFlag } from "@/lib/countries";

export function GeoRankList({
  label,
  slices,
  showFlag,
}: {
  label: string;
  slices: DemographicSlice[];
  showFlag?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="space-y-1.5">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            {showFlag && <span>{countryFlag(s.key)}</span>}
            <span className="flex-1 truncate text-card-foreground">{s.label}</span>
            <span className="font-medium text-muted-foreground">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
