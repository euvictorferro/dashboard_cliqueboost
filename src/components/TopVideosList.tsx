import type { TopVideo } from "@/lib/metrics";

export function TopVideosList({ videos }: { videos: TopVideo[] }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <h3 className="mb-3 text-sm font-medium text-card-foreground">5 melhores vídeos</h3>
      <ol className="space-y-2">
        {videos.map((v, i) => (
          <li key={v.id} className="flex items-center gap-3">
            <span className="w-4 text-sm text-muted-foreground">{i + 1}</span>
            <span
              className="h-8 w-8 shrink-0 rounded-md"
              style={{ backgroundColor: v.thumbnailColor }}
            />
            <span className="flex-1 text-sm text-card-foreground">{v.title}</span>
            <span className="text-sm text-muted-foreground">{v.views.toLocaleString("pt-BR")} views</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
