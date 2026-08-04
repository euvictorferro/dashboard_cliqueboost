# Booster AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página de chat onde o cliente conversa com um bot que consulta, sob demanda (tool use), as métricas, conteúdos, tasks e atas da própria conta — nunca de outro cliente — com resposta em streaming e histórico persistido.

**Architecture:** Um client de streaming genérico pra Messages API da Anthropic (`anthropicStream.ts`, SSE parseado à mão) é a base; as 4 tools do bot (`boosterAiTools.ts`) reaproveitam funções já existentes do projeto (métricas com fallback live→mock idêntico ao `/api/organic`, Trello, ClickUp, atas). A rota de chat orquestra um loop agente (chama o modelo → se pedir tool, executa e devolve o resultado → repete até ter resposta final) e transmite só o texto final via streaming pro navegador.

**Tech Stack:** Next.js App Router (Route Handlers com `ReadableStream`), Supabase (Postgres), TypeScript, Anthropic Messages API (fetch cru + parser SSE manual, sem SDK).

## Global Constraints

- Nenhuma rota/lib nova usa SDK externo — chamada à Anthropic é `fetch` cru com parsing manual de Server-Sent Events, mesmo padrão de `taskExtraction.ts` (sem streaming) levado adiante pra streaming.
- Toda rota client-facing sob `/api/booster-ai/...` exige `verifyClientToken` antes de qualquer efeito colateral (chamar a IA, gravar mensagem).
- O `clientId` usado nas tools vem sempre do objeto `Client` já resolvido pelo servidor (`CLIENTS.find`) — nunca de um parâmetro que o modelo possa preencher. Nenhuma tool aceita `client_id`/`clientId` como argumento do modelo.
- `src/lib/*.ts` que usam segredos levam `// ponytail: server-only — nunca importar isto de um componente "use client"`.
- Migration com RLS ligado, sem policies (só Service Role acessa).
- Métricas: usar o mesmo padrão de fallback do `/api/organic/[client]/route.ts` — tenta `fetchOrganicSnapshotLive` (dados reais da Graph API) se `client.instagramBusinessId && hasMetaCredentials()`, senão (ou se der erro) cai pro mock `getOrganicSnapshot`. Nunca usar só o mock diretamente — isso mostraria dado falso pro cliente sem necessidade quando dado real está disponível.
- Mensagens de tool call/tool result não são persistidas em `chat_messages` — só a pergunta do usuário e o texto final do assistente.
- Limite diário: 50 mensagens de `role='user'` por cliente por dia civil, calculado no fuso do cliente (via `Intl`, mesmo padrão de precisão usado em `googleCalendar.ts`, não no fuso do servidor).
- Projeto não tem suíte de testes automatizados — verificação é `npx tsc --noEmit` limpo (e `npm run build` na última task).

---

### Task 1: Migration `chat_messages` + `src/lib/chatMessages.ts`

**Files:**
- Create: `supabase/migrations/0015_chat_messages.sql`
- Create: `src/lib/chatMessages.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin` de `src/lib/supabase.ts`.
- Produces: `ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: number }`; `fetchRecentMessages(clientId: string, limit: number): Promise<ChatMessage[]>` (ordenado do mais antigo pro mais novo); `saveMessage(clientId: string, role: "user" | "assistant", content: string): Promise<void>`; `countMessagesTodayInTimeZone(clientId: string, timeZone: string): Promise<number>`.

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0015_chat_messages.sql
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;
```

O Victor roda essa migration no SQL Editor do Supabase antes do próximo passo.

- [ ] **Step 2: Criar `src/lib/chatMessages.ts`**

```ts
// src/lib/chatMessages.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: number };

export async function fetchRecentMessages(clientId: string, limit: number): Promise<ChatMessage[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant",
      content: row.content,
      createdAt: Date.parse(row.created_at),
    }))
    .reverse();
}

export async function saveMessage(clientId: string, role: "user" | "assistant", content: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase.from("chat_messages").insert({ client_id: clientId, role, content });
  if (error) throw new Error(error.message);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - date.getTime();
}

function startOfTodayUtcMs(timeZone: string): number {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = dtf.formatToParts(now).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const naiveUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const offset = getTimeZoneOffsetMs(new Date(naiveUTC), timeZone);
  return naiveUTC - offset;
}

export async function countMessagesTodayInTimeZone(clientId: string, timeZone: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const since = new Date(startOfTodayUtcMs(timeZone)).toISOString();
  const { count, error } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("role", "user")
    .gte("created_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `chatMessages.ts` (ignore ruído pré-existente de `.next/dev/types/validator.ts` sobre `/api/zzdebug`, não relacionado).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0015_chat_messages.sql src/lib/chatMessages.ts
git commit -m "feat: tabela chat_messages + camada de dados (histórico + limite diário)"
```

---

### Task 2: `src/lib/anthropicStream.ts` — client de streaming genérico (SSE manual)

**Files:**
- Create: `src/lib/anthropicStream.ts`

**Interfaces:**
- Consumes: `process.env.ANTHROPIC_API_KEY`.
- Produces: `AnthropicContentBlock = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }`; `AnthropicMessage = { role: "user" | "assistant"; content: string | unknown[] }`; `AnthropicTool = { name: string; description: string; input_schema: object }`; `AnthropicTurnResult = { stopReason: string; content: AnthropicContentBlock[]; toolUses: { id: string; name: string; input: unknown }[]; finalText: string }`; `streamAnthropicTurn(messages: AnthropicMessage[], tools: AnthropicTool[], system: string, onTextDelta: (delta: string) => void): Promise<AnthropicTurnResult>`.

- [ ] **Step 1: Criar `src/lib/anthropicStream.ts`**

```ts
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
      model: "claude-sonnet-5",
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
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/anthropicStream.ts
git commit -m "feat: client de streaming SSE manual pra Anthropic Messages API (sem SDK)"
```

---

### Task 3: `src/lib/boosterAiTools.ts` — definição das 4 tools + dispatcher

**Files:**
- Create: `src/lib/boosterAiTools.ts`

**Interfaces:**
- Consumes: `Client` de `src/lib/clients.ts`; `DATE_RANGES`, `getOrganicSnapshot`, `DateRangeId` de `src/lib/metrics.ts`; `fetchOrganicSnapshotLive`, `hasMetaCredentials` de `src/lib/meta.ts`; `fetchClientBoard` de `src/lib/trello.ts`; `fetchClientTasks` de `src/lib/clickup.ts`; `fetchCallNotes` de `src/lib/callNotes.ts`; `AnthropicTool` de `src/lib/anthropicStream.ts`.
- Produces: `BOOSTER_AI_TOOLS: AnthropicTool[]`; `runBoosterAiTool(name: string, input: unknown, client: Client): Promise<unknown>`.

- [ ] **Step 1: Criar `src/lib/boosterAiTools.ts`**

```ts
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
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/boosterAiTools.ts
git commit -m "feat: tools do Booster AI (métricas, conteúdos, tasks, atas) + dispatcher"
```

---

### Task 4: Rotas `POST /api/booster-ai/[client]/chat` e `GET /api/booster-ai/[client]/messages`

**Files:**
- Create: `src/app/api/booster-ai/[client]/chat/route.ts`
- Create: `src/app/api/booster-ai/[client]/messages/route.ts`

**Interfaces:**
- Consumes: `verifyClientToken` de `src/lib/access.ts`; `CLIENTS` de `src/lib/clients.ts`; `fetchClientSettings` de `src/lib/clientSettings.ts`; `fetchRecentMessages`, `saveMessage`, `countMessagesTodayInTimeZone` de `src/lib/chatMessages.ts`; `streamAnthropicTurn`, `AnthropicMessage` de `src/lib/anthropicStream.ts`; `BOOSTER_AI_TOOLS`, `runBoosterAiTool` de `src/lib/boosterAiTools.ts`.
- Produces: `POST /api/booster-ai/[client]/chat` — recebe `{ message: string }`, retorna `Response` com corpo em streaming (texto puro, `Content-Type: text/plain`). `GET /api/booster-ai/[client]/messages` — retorna `{ messages: ChatMessage[] }`.

- [ ] **Step 1: Criar a rota de chat**

```ts
// src/app/api/booster-ai/[client]/chat/route.ts
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
```

- [ ] **Step 2: Criar a rota de histórico**

```ts
// src/app/api/booster-ai/[client]/messages/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientToken } from "@/lib/access";
import { fetchRecentMessages } from "@/lib/chatMessages";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const messages = await fetchRecentMessages(clientId, 50);
    return Response.json({ messages });
  } catch (err) {
    console.error(`[booster-ai/messages] falha ao buscar histórico de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Verificação manual**

Com `ANTHROPIC_API_KEY` já configurada e `npm run dev` rodando:

```bash
curl -s -N -X POST "http://localhost:3000/api/booster-ai/debora/chat?key=<token_real>" \
  -H "Content-Type: application/json" \
  -d '{"message": "como estão minhas métricas dos últimos 30 dias?"}'
```

Expected: texto da resposta do bot aparecendo (streaming — `curl -N` desabilita buffering), citando números reais ou mockados. Depois:

```bash
curl -s "http://localhost:3000/api/booster-ai/debora/messages?key=<token_real>" | python3 -m json.tool
```

Expected: JSON com as duas mensagens (usuário + assistente) salvas.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/booster-ai/
git commit -m "feat: rotas de chat (streaming + loop de tools) e histórico do Booster AI"
```

---

### Task 5: UI — página e componente de chat

**Files:**
- Create: `src/app/[client]/booster-ai/page.tsx`
- Create: `src/components/BoosterAiPageClient.tsx`

**Interfaces:**
- Consumes: `POST /api/booster-ai/[client]/chat` (Task 4), `GET /api/booster-ai/[client]/messages` (Task 4), `ChatMessage` de `src/lib/chatMessages.ts`, `verifyClientToken`, `CLIENTS`, `AccessDenied`, `Sidebar` (com `active="booster-ai"`, adicionado na Task 6).

- [ ] **Step 1: Criar `src/components/BoosterAiPageClient.tsx`**

```tsx
// src/components/BoosterAiPageClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chatMessages";

type UiMessage = { role: "user" | "assistant"; content: string };

export function BoosterAiPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/booster-ai/${clientId}/messages?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { messages: ChatMessage[] };
      })
      .then((data) => setMessages(data.messages.map((m) => ({ role: m.role, content: m.content }))))
      .catch(() => setLoadError(true));
  }, [clientId, accessKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/booster-ai/${clientId}/chat?key=${encodeURIComponent(accessKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) throw new Error();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const snapshot = acc;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: snapshot };
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: "Não foi possível responder agora, tenta de novo." };
        return next;
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[900px] flex-col px-6 py-10 sm:px-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Booster AI</h1>
      {loadError && (
        <p className="mb-4 rounded-[var(--radius-card)] bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Não foi possível carregar o histórico agora.
        </p>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] rounded-[var(--radius-card)] p-3 text-sm shadow-[var(--shadow-soft)] ${
              m.role === "user" ? "ml-auto bg-brand-primary text-white" : "bg-card text-card-foreground"
            }`}
          >
            {m.content || (m.role === "assistant" && sending ? "..." : "")}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="mt-4 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Pergunte sobre seus números, conteúdos, tasks ou atas..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Criar `src/app/[client]/booster-ai/page.tsx`**

```tsx
// src/app/[client]/booster-ai/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { BoosterAiPageClient } from "@/components/BoosterAiPageClient";
import { verifyClientToken } from "@/lib/access";

export default async function ClientBoosterAiPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { client } = await params;
  const { key } = await searchParams;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientToken(found.id, key);
  if (!authorized) return <AccessDenied />;

  return (
    <div className="flex min-h-full">
      <Sidebar clientId={found.id} accessKey={key!} active="booster-ai" />
      <div className="min-w-0 flex-1">
        <BoosterAiPageClient clientId={found.id} accessKey={key!} />
      </div>
    </div>
  );
}
```

Nota: `active="booster-ai"` só vai compilar depois que `ActiveKey` (em `Sidebar.tsx`) incluir esse valor — feito na Task 6. Se rodar `tsc` antes da Task 6, é esperado um erro de tipo aqui; a Task 6 fecha isso.

- [ ] **Step 3: Commit**

```bash
git add src/app/\[client\]/booster-ai/ src/components/BoosterAiPageClient.tsx
git commit -m "feat: página e componente de chat do Booster AI"
```

---

### Task 6: Sidebar — item "Booster AI" entre Atas e Conta

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: `ActiveKey` ganha `"booster-ai"`; `Sidebar` aceita `active="booster-ai"`.

- [ ] **Step 1: Adicionar o ícone**

Adicionar, junto das outras funções de ícone (ex: depois de `ContaIcon`):

```tsx
function BoosterAiIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 8.5c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5-2.7 5.5-6 5.5c-.7 0-1.4-.1-2-.3L4 15l.8-2.8C3.7 11.1 3 9.9 3 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="6.5" cy="8.5" r="0.9" fill="currentColor" />
      <circle cx="9" cy="8.5" r="0.9" fill="currentColor" />
      <circle cx="11.5" cy="8.5" r="0.9" fill="currentColor" />
    </svg>
  );
}
```

- [ ] **Step 2: Atualizar `ActiveKey` e `ITEMS_AFTER_SOCIAL`**

Trocar:
```tsx
type ActiveKey = "dashboard" | "tasks" | "atas" | "conta" | "conteudos" | "calendario" | "bunker";
```
por:
```tsx
type ActiveKey = "dashboard" | "tasks" | "atas" | "booster-ai" | "conta" | "conteudos" | "calendario" | "bunker";
```

Trocar:
```tsx
const ITEMS_AFTER_SOCIAL: NavItemDef[] = [
  { href: "/atas", label: "Atas", key: "atas", icon: AtasIcon },
  { href: "/conta", label: "Conta", key: "conta", icon: ContaIcon },
];
```
por:
```tsx
const ITEMS_AFTER_SOCIAL: NavItemDef[] = [
  { href: "/atas", label: "Atas", key: "atas", icon: AtasIcon },
  { href: "/booster-ai", label: "Booster AI", key: "booster-ai", icon: BoosterAiIcon },
  { href: "/conta", label: "Conta", key: "conta", icon: ContaIcon },
];
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros (a Task 5 já usava `active="booster-ai"`, este passo fecha o tipo).

- [ ] **Step 4: Rodar `npm run build` (checagem final de todo o plano)**

Run: `npm run build`
Expected: build limpo, sem erros de tipo ou de rota.

- [ ] **Step 5: Verificação manual no navegador**

Abrir `http://localhost:3000/debora/booster-ai?key=<token_real>`, mandar uma pergunta sobre métricas/conteúdos/tasks/atas e confirmar que a resposta aparece com efeito de streaming, cita dados reais da Débora, e que o item "Booster AI" aparece na sidebar entre Atas e Conta, destacado quando a página está ativa.

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: item Booster AI na sidebar, entre Atas e Conta"
```
