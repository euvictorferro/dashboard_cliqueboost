// src/lib/boosterAiTools.ts
// ponytail: server-only — nunca importar isto de um componente "use client".
import type { Client } from "./clients";
import { DATE_RANGES, getOrganicSnapshot, type DateRangeId } from "./metrics";
import { fetchOrganicSnapshotLive, hasMetaCredentials } from "./meta";
import { fetchClientBoard } from "./trello";
import { fetchClientTasks } from "./clickup";
import { fetchCallNotes } from "./callNotes";
import type { AnthropicTool } from "./anthropicStream";

export const BOOSTER_AI_TOOLS: AnthropicTool[] = [
  {
    name: "buscar_metricas",
    description:
      "Busca as métricas orgânicas do Instagram do cliente (alcance, engajamento, seguidores, top posts) para um período.",
    input_schema: {
      type: "object",
      properties: {
        range: {
          type: "string",
          enum: ["1d", "7d", "14d", "30d", "60d", "90d"],
          description: "Período das métricas.",
        },
      },
      required: ["range"],
    },
  },
  {
    name: "buscar_conteudos",
    description: "Busca os cards do quadro de conteúdo do cliente (ideias, status, datas de posts planejados e publicados).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "buscar_tasks",
    description: "Busca as tarefas (tasks) do cliente, abertas e concluídas.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "buscar_atas",
    description: "Busca as atas de reuniões já registradas com o cliente.",
    input_schema: { type: "object", properties: {} },
  },
];

export async function runBoosterAiTool(name: string, input: unknown, client: Client): Promise<unknown> {
  switch (name) {
    case "buscar_metricas": {
      const requestedRange = (input as { range?: string } | null)?.range;
      const range: DateRangeId = DATE_RANGES.some((r) => r.id === requestedRange) ? (requestedRange as DateRangeId) : "30d";
      if (client.instagramBusinessId && hasMetaCredentials()) {
        try {
          return await fetchOrganicSnapshotLive(client.instagramBusinessId, range);
        } catch (err) {
          // ponytail: mesmo fallback do /api/organic — nunca quebra o chat por erro da Graph API.
          console.error(`[booster-ai] live fetch de métricas falhou pra ${client.id}:`, err);
        }
      }
      return getOrganicSnapshot(client.id, range);
    }
    case "buscar_conteudos": {
      if (!client.trelloBoardId) return { error: "not_configured" };
      return await fetchClientBoard(client.trelloBoardId);
    }
    case "buscar_tasks": {
      if (!client.clickupListId) return { error: "not_configured" };
      return await fetchClientTasks(client.clickupListId);
    }
    case "buscar_atas": {
      return await fetchCallNotes(client.id);
    }
    default:
      return { error: "unknown_tool" };
  }
}
