import type { ContentCard as ContentCardData } from "@/lib/trello";

function formatDueDate(dueDate: number | null): string {
  if (dueDate === null) return "Sem prazo";
  return new Date(dueDate).toLocaleDateString("pt-BR");
}

function formatAssignees(assignees: string[]): string {
  return assignees.length > 0 ? assignees.join(", ") : "Sem responsável";
}

export function ContentCard({ card }: { card: ContentCardData }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-3 shadow-[var(--shadow-soft)]">
      <p className="text-sm font-medium text-card-foreground">{card.name}</p>
      {card.description && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{card.description}</p>}
      {card.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.labels.map((label, i) => (
            <span
              key={`${label.name}-${i}`}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        <p>{formatDueDate(card.dueDate)}</p>
        <p>{formatAssignees(card.assignees)}</p>
      </div>
      {card.attachments.length > 0 && (
        <div className="mt-2 space-y-1">
          {card.attachments.map((a) => (
            <a
              key={a.url}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[11px] text-brand-accent hover:underline"
            >
              🔗 {a.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
