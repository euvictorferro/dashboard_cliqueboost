export function ReachBarChart({ data }: { data: { date: string; value: number }[] }) {
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
            <div className="pointer-events-none absolute bottom-full mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background group-hover:block">
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
