import { DATE_RANGES, type DateRangeId } from "@/lib/metrics";

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRangeId;
  onChange: (id: DateRangeId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[var(--radius-card)] border border-border bg-card p-1">
      {DATE_RANGES.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            value === r.id
              ? "bg-brand-primary text-white"
              : "text-muted-foreground hover:text-card-foreground"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
