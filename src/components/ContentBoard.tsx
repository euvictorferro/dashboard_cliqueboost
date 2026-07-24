import type { ContentList } from "@/lib/trello";
import { ContentCard } from "./ContentCard";

export function ContentBoard({ lists }: { lists: ContentList[] }) {
  if (lists.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">Nenhuma lista encontrada.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {lists.map((list) => (
        <div key={list.id} className="w-72 shrink-0 rounded-[var(--radius-card)] bg-muted/40 p-3">
          <div className="mb-3 flex items-center gap-2 px-1">
            <p className="text-sm font-semibold text-card-foreground">{list.name}</p>
            <span className="text-xs font-medium text-muted-foreground">{list.cards.length}</span>
          </div>
          <div className="space-y-2">
            {list.cards.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Sem cards</p>
            ) : (
              list.cards.map((card) => <ContentCard key={card.id} card={card} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
