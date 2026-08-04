// src/lib/taskExtraction.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a chave da Anthropic).
const EXTRACT_TOOL = {
  name: "extract_tasks",
  description: "Registra os itens de ação (tasks) identificados no texto de uma ata de reunião.",
  input_schema: {
    type: "object" as const,
    properties: {
      tasks: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            title: { type: "string" as const, description: "Título curto da task, no imperativo." },
            description: { type: "string" as const, description: "Detalhe da task, 1-2 frases." },
          },
          required: ["title", "description"],
        },
      },
    },
    required: ["tasks"],
  },
};

export async function extractTasksFromNote(content: string): Promise<{ title: string; description: string }[]> {
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
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_tasks" },
      messages: [
        {
          role: "user",
          content: `Leia esta ata de reunião e extraia os itens de ação (tarefas a fazer) mencionados. Se não houver nenhum, retorne uma lista vazia.\n\n${content}`,
        },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`anthropic_failed: ${JSON.stringify(json)}`);

  const toolUse = json.content?.find((block: { type: string }) => block.type === "tool_use");
  if (!toolUse) return [];
  return (toolUse.input.tasks ?? []) as { title: string; description: string }[];
}
