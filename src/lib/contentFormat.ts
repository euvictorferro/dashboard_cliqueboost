// src/lib/contentFormat.ts
import type { ContentCard as ContentCardData } from "./trello";

// ponytail: classificação por label do Trello, não pelo nome do card — se o cliente não usa
// nenhuma dessas labels ainda (alguns boards só têm labels de status), o card cai no "default".
export type ContentFormat = "video" | "text" | null;

export function getContentFormat(card: ContentCardData): ContentFormat {
  if (card.labels.some((l) => /reels?|tiktok/i.test(l.name))) return "video";
  if (card.labels.some((l) => /carrossel|post ú?nico|artigo|linkedin|blog/i.test(l.name))) return "text";
  return null;
}

export const FORMAT_BAR_CLASSES: Record<"video" | "text" | "default", string> = {
  video: "bg-purple-500/15 text-purple-600 hover:bg-purple-500/25",
  text: "bg-blue-500/15 text-blue-600 hover:bg-blue-500/25",
  default: "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20",
};
