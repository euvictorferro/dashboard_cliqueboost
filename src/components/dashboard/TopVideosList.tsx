import type { TopPost } from "@/lib/metrics";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

function PostRow({ post, max }: { post: TopPost; max: number }) {
  return (
    <>
      {post.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnail vem de URL assinada da Meta, não é asset local
        <img src={post.thumbnailUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="h-11 w-11 shrink-0 rounded-lg" style={{ backgroundColor: post.thumbnailColor }} />
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm text-card-foreground sm:line-clamp-1">{post.title}</p>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-track">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent"
              style={{ width: `${Math.max(6, (post.likes / max) * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {post.likes.toLocaleString("pt-BR")} curtidas
          </span>
        </div>
      </div>
    </>
  );
}

export function TopVideosList({ posts }: { posts: TopPost[] }) {
  const max = Math.max(1, ...posts.map((p) => p.likes));

  return (
    <div className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        Top 5 posts
        <InfoTooltip text="Essa seção mostra suas 5 melhores postagens no período que você selecionou no filtro." />
      </h3>
      <ol className="space-y-4">
        {posts.map((p) =>
          p.permalink ? (
            <li key={p.id}>
              <a
                href={p.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative -m-2 flex items-center gap-3 rounded-lg p-2"
              >
                <div className="flex flex-1 items-center gap-3 transition-[filter] duration-150 group-hover:blur-[2px]">
                  <PostRow post={p} max={max} />
                </div>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-card/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <span className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background">
                    Ver post →
                  </span>
                </div>
              </a>
            </li>
          ) : (
            <li key={p.id} className="flex items-center gap-3">
              <PostRow post={p} max={max} />
            </li>
          )
        )}
      </ol>
    </div>
  );
}
