import type { TopPost } from "@/lib/metrics";

export function TopVideosList({ posts }: { posts: TopPost[] }) {
  const max = Math.max(1, ...posts.map((p) => p.likes));

  return (
    <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Top 5 posts</h3>
      <ol className="space-y-4">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            {p.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- thumbnail vem de URL assinada da Meta, não é asset local
              <img src={p.thumbnailUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="h-11 w-11 shrink-0 rounded-lg" style={{ backgroundColor: p.thumbnailColor }} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-card-foreground">{p.title}</p>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-track">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent"
                    style={{ width: `${Math.max(6, (p.likes / max) * 100)}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {p.likes.toLocaleString("pt-BR")} curtidas
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
