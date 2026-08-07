// src/lib/videoTakes.ts
// ponytail: server-only — usa GROQ_API_KEY/ANTHROPIC_API_KEY.
import Anthropic from "@anthropic-ai/sdk";
import { downloadFile } from "./googleDrive";

export type TakeMatch = { fileId: string; take: string | null; confidence: "high" | "low" };

export function hasVideoTakesCredentials(): boolean {
  return Boolean(process.env.GROQ_API_KEY) && Boolean(process.env.ANTHROPIC_API_KEY);
}

// ponytail: já existe no nome do arquivo -> considerado processado, pula transcrição/matching de novo.
export function isAlreadyNamedAsTake(fileName: string): boolean {
  return /^take\d+\./i.test(fileName);
}

export async function transcribeVideo(fileId: string, mimeType: string): Promise<string> {
  const bytes = await downloadFile(fileId);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), "video");
  form.append("model", "whisper-large-v3-turbo");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`groq_transcription_failed: ${await res.text()}`);
  const json = await res.json();
  return String(json.text ?? "");
}

const anthropic = new Anthropic();

const MATCH_TOOL = {
  name: "match_takes",
  description: "Devolve o take correspondente de cada vídeo transcrito, com base no roteiro.",
  input_schema: {
    type: "object" as const,
    properties: {
      matches: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            fileId: { type: "string" as const },
            take: { type: "string" as const, description: "ex: 'take1' — string vazia se não identificar" },
            confidence: { type: "string" as const, enum: ["high", "low"] },
          },
          required: ["fileId", "take", "confidence"],
        },
      },
    },
    required: ["matches"],
  },
};

// ponytail: um tool call forçado em vez de parsear texto livre — resposta sempre estruturada,
// sem parser de JSON manual sujeito a quebrar com markdown/texto extra do modelo.
export async function matchTakesToScript(
  description: string,
  transcripts: { fileId: string; name: string; transcript: string }[]
): Promise<TakeMatch[]> {
  if (transcripts.length === 0) return [];

  const prompt = `Roteiro do post (descrição do card):\n${description}\n\nVídeos transcritos:\n${transcripts
    .map((t) => `- fileId=${t.fileId} nome original="${t.name}"\n  transcrição: ${t.transcript}`)
    .join("\n")}\n\nPra cada vídeo, identifique a qual take do roteiro ele corresponde (ex: "take1", "take2"). Se o roteiro não distinguir takes numerados, use a ordem em que aparecem no texto. "confidence": "high" só quando o conteúdo falado bater claramente com aquele trecho do roteiro; "low" (com "take": "" se não der pra saber qual) em qualquer caso de dúvida — inclusive vídeo sem relação nenhuma com o roteiro.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    tools: [MATCH_TOOL],
    tool_choice: { type: "tool", name: "match_takes" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("anthropic_no_tool_use");
  const input = toolUse.input as { matches: TakeMatch[] };
  return input.matches.map((m) => ({ ...m, take: m.take || null }));
}
