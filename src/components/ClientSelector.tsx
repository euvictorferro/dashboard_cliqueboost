import { CLIENTS } from "@/lib/clients";

export function ClientSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[var(--radius-card)] border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground"
    >
      {CLIENTS.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
