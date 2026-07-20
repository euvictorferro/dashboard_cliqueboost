export function MetricCard({
  label,
  description,
  value,
}: {
  label: string;
  description: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
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
      <p className="mt-1 text-2xl font-semibold text-card-foreground">{value}</p>
    </div>
  );
}
