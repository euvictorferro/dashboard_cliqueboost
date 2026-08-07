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

// ponytail: versão sólida (fundo cheio + texto branco) pra bater com o estilo do chip de
// evento do exemplo — usada nos chips do mês/semana/dia.
export const FORMAT_SOLID_CLASSES: Record<"video" | "text" | "default", string> = {
  video: "bg-purple-500 text-white hover:bg-purple-600",
  text: "bg-blue-500 text-white hover:bg-blue-600",
  default: "bg-brand-primary text-white hover:bg-brand-primary/90",
};

export const FORMAT_DOT_CLASSES: Record<"video" | "text" | "default", string> = {
  video: "bg-purple-500",
  text: "bg-blue-500",
  default: "bg-brand-primary",
};
