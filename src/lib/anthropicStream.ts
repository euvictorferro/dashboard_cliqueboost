// src/lib/anthropicStream.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a chave da Anthropic).

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

export type AnthropicMessage = { role: "user" | "assistant"; content: string | unknown[] };

export type AnthropicTool = { name: string; description: string; input_schema: object };

export type AnthropicTurnResult = {
  stopReason: string;
  content: AnthropicContentBlock[];
  toolUses: { id: string; name: string; input: unknown }[];
  finalText: string;
};

type StreamBlock = { type: "text" | "tool_use"; text: string; id?: string; name?: string; jsonInput: string };

export async function streamAnthropicTurn(
  messages: AnthropicMessage[],
  tools: AnthropicTool[],
  system: string,
  onTextDelta: (delta: string) => void
): Promise<AnthropicTurnResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system,
      tools,
      stream: true,
      messages,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(`anthropic_stream_failed: ${res.status} ${text}`);
  }

  const blocks: StreamBlock[] = [];
  let stopReason = "end_turn";
  let buffer = "";

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);

      const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      const payload = JSON.parse(dataLine.slice("data: ".length));

      if (payload.type === "content_block_start") {
        const cb = payload.content_block;
        if (cb.type === "text") {
          blocks[payload.index] = { type: "text", text: "", jsonInput: "" };
        } else if (cb.type === "tool_use") {
          blocks[payload.index] = { type: "tool_use", text: "", id: cb.id, name: cb.name, jsonInput: "" };
        }
      } else if (payload.type === "content_block_delta") {
        const block = blocks[payload.index];
        if (!block) continue;
        if (payload.delta.type === "text_delta") {
          block.text += payload.delta.text;
          onTextDelta(payload.delta.text);
        } else if (payload.delta.type === "input_json_delta") {
          block.jsonInput += payload.delta.partial_json;
        }
      } else if (payload.type === "message_delta") {
        stopReason = payload.delta.stop_reason ?? stopReason;
      }
    }
  }

  const content: AnthropicContentBlock[] = blocks
    .filter((b): b is StreamBlock => Boolean(b))
    .map((b) =>
      b.type === "text"
        ? { type: "text" as const, text: b.text }
        : { type: "tool_use" as const, id: b.id!, name: b.name!, input: b.jsonInput ? JSON.parse(b.jsonInput) : {} }
    );

  const toolUses = content
    .filter((c): c is { type: "tool_use"; id: string; name: string; input: unknown } => c.type === "tool_use")
    .map((c) => ({ id: c.id, name: c.name, input: c.input }));

  const finalText = content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("");

  return { stopReason, content, toolUses, finalText };
}
