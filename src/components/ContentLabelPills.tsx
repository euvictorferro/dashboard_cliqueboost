// src/components/ContentLabelPills.tsx
import type { ContentLabel } from "@/lib/trello";

// ponytail: mostra as labels reais do Trello (Reels, TikTok, Carrossel...) em vez de só
// classificar vídeo/texto — o cliente já nomeia os formatos lá, é só reaproveitar.
export function ContentLabelPills({ labels, size = "sm" }: { labels: ContentLabel[]; size?: "sm" | "xs" }) {
  if (labels.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {labels.map((label) => (
        <span
          key={label.id}
          className={`inline-flex items-center gap-1 rounded-full border border-border bg-card font-medium text-card-foreground ${
            size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
          }`}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} aria-hidden="true" />
          {label.name}
        </span>
      ))}
    </div>
  );
}
