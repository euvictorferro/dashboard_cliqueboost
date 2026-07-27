// src/lib/contentFormat.ts
import type { ContentCard as ContentCardData } from "./trello";

// ponytail: classificação por label do Trello OU pelo título do card — alguns clientes (ex:
// Débora) não usam labels de formato, só escrevem "[Carrossel]"/"[Reels]" no título. Se nenhum
// dos dois bater, o card cai no "default".
export type ContentFormat = "video" | "text" | null;

const VIDEO_PATTERN = /reels?|tiktok/i;
const TEXT_PATTERN = /carrossel|post ú?nico|artigo|linkedin|blog/i;

export function getContentFormat(card: ContentCardData): ContentFormat {
  if (card.labels.some((l) => VIDEO_PATTERN.test(l.name)) || VIDEO_PATTERN.test(card.name)) return "video";
  if (card.labels.some((l) => TEXT_PATTERN.test(l.name)) || TEXT_PATTERN.test(card.name)) return "text";
  return null;
}

export const FORMAT_BAR_CLASSES: Record<"video" | "text" | "default", string> = {
  video: "bg-purple-500/15 text-purple-600 hover:bg-purple-500/25",
  text: "bg-blue-500/15 text-blue-600 hover:bg-blue-500/25",
  default: "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20",
};
