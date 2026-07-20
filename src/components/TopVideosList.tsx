import type { TopPost } from "@/lib/metrics";

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
        <p className="truncate text-sm text-card-foreground">{post.title}</p>
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
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">Top 5 posts</h3>
      <ol className="space-y-4">
        {posts.map((p) =>
          p.permalink ? (
            <li key={p.id}>
              <a
                href={p.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="-m-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
              >
                <PostRow post={p} max={max} />
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
