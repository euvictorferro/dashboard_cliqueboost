import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientToken } from "@/lib/access";
import { fetchClientSettings } from "@/lib/clientSettings";
import { fetchRecentMessages, saveMessage, countMessagesTodayInTimeZone } from "@/lib/chatMessages";
import { streamAnthropicTurn, type AnthropicMessage } from "@/lib/anthropicStream";
import { BOOSTER_AI_TOOLS, runBoosterAiTool } from "@/lib/boosterAiTools";

const DAILY_LIMIT = 50;
const MAX_TOOL_ITERATIONS = 5;
const HISTORY_LIMIT = 50;

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const userMessage = body?.message;
  if (typeof userMessage !== "string" || userMessage.trim().length === 0) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { timeZone } = await fetchClientSettings(clientId);
  const usedToday = await countMessagesTodayInTimeZone(clientId, timeZone);
  if (usedToday >= DAILY_LIMIT) {
    return Response.json({ error: "daily_limit_reached" }, { status: 429 });
  }

  await saveMessage(clientId, "user", userMessage.trim());
  const history = await fetchRecentMessages(clientId, HISTORY_LIMIT);
  const initialMessages: AnthropicMessage[] = history.map((m) => ({ role: m.role, content: m.content }));

  const system = `Você é o Booster AI, assistente da agência Clique Boost. Você está conversando com ${client.name}. Responda apenas sobre a conta e os dados deste cliente específico. Nunca mencione, compare ou revele informações de outros clientes da agência. Seja direto e útil, respondendo sempre em português.`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        let currentMessages = initialMessages;
        let finalText = "";

        for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
          const turn = await streamAnthropicTurn(currentMessages, BOOSTER_AI_TOOLS, system, (delta) => {
            controller.enqueue(encoder.encode(delta));
          });
          currentMessages = [...currentMessages, { role: "assistant", content: turn.content }];

          if (turn.stopReason !== "tool_use") {
            finalText = turn.finalText;
            break;
          }

          const toolResults = await Promise.all(
            turn.toolUses.map(async (tu) => ({
              type: "tool_result" as const,
              tool_use_id: tu.id,
              content: JSON.stringify(await runBoosterAiTool(tu.name, tu.input, client)),
            }))
          );
          currentMessages = [...currentMessages, { role: "user", content: toolResults }];
        }

        if (finalText) {
          await saveMessage(clientId, "assistant", finalText);
        }
      } catch (err) {
        console.error(`[booster-ai/chat] falha ao processar mensagem de ${clientId}:`, err);
        controller.enqueue(encoder.encode("\n\n[Erro ao processar sua mensagem, tenta de novo.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
