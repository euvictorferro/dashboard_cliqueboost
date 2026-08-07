# Conteúdos — IA de identificação de takes (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao final de um lote de upload de vídeos num post, o sistema transcreve os arquivos novos, casa cada um com o take correspondente no roteiro (descrição do card do Trello) via LLM, e renomeia no Drive os que tiverem alta confiança. Duvidosos ficam com o nome original e viram um comentário no Trello avisando o editor.

**Architecture:** Task 1 adiciona `renameFile` ao `googleDrive.ts` (já existe). Task 2 cria `src/lib/videoTakes.ts` com a transcrição (Groq Whisper) e o matching (LLM). Task 3 expõe isso via `POST .../videos/match-takes`. Task 4 dispara a rota automaticamente no frontend ao final do upload.

**Tech Stack:** Next.js 16 App Router, TypeScript. Duas integrações novas: Groq (transcrição, REST direto via `fetch`, sem SDK) e um provider de LLM pra matching — **Anthropic** (`@anthropic-ai/sdk`), reaproveitando a mesma família de modelo já usada por este agente, com Structured Output via tool-forcing pro JSON de matching.

## Global Constraints

- Sem tabela nova no Supabase — mesmo padrão da Fase 1: Drive e Trello são a fonte de verdade, processamento sob demanda, sem cache local.
- Idempotência: um vídeo cujo nome já bate com `/^take\d+\./i` é considerado já processado e nunca entra de novo no pipeline de transcrição/matching.
- Falha em qualquer etapa da IA (transcrição, matching, rename) não pode quebrar o upload em si — o vídeo já está salvo no Drive antes da IA rodar; se a IA falhar, ele só fica com o nome original (mesmo estado de "ainda não processado").
- Rename só acontece pra vídeos com `confidence: "high"` — nunca força um match duvidoso.
- Env vars novas a configurar em Development/Preview/Production: `GROQ_API_KEY`, `ANTHROPIC_API_KEY`.
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, e checagem ao vivo com o dev server.

---

### Task 1: `renameFile` em `src/lib/googleDrive.ts`

**Files:**
- Modify: `src/lib/googleDrive.ts`

**Interfaces:**
- Produces: `renameFile(fileId: string, name: string): Promise<void>`, usada pela Task 3.

- [ ] **Step 1: Adicionar `renameFile` logo após `deleteFile`**

```ts
export async function renameFile(fileId: string, name: string): Promise<void> {
  const accessToken = await getAccessToken();
  await driveFetch(`files/${fileId}?fields=id`, accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

// ponytail: baixa o arquivo inteiro pra memória — vídeos de post são curtos (poucos MB a
// dezenas de MB), cabe tranquilo. Upgrade se algum dia entrar vídeo de horas: streaming
// direto pro provedor de transcrição em vez de bufferizar aqui.
export async function downloadFile(fileId: string): Promise<Buffer> {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`google_drive_download_failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/googleDrive.ts
git commit -m "feat(conteudos): renameFile e downloadFile no googleDrive.ts"
```

---

### Task 2: `src/lib/videoTakes.ts` — transcrição e matching

**Files:**
- Create: `src/lib/videoTakes.ts`
- Modify: `package.json` (adicionar `@anthropic-ai/sdk`)

**Interfaces:**
- Consumes: `downloadFile` de `src/lib/googleDrive.ts` (Task 1); env vars `GROQ_API_KEY`, `ANTHROPIC_API_KEY`.
- Produces: `hasVideoTakesCredentials(): boolean`, `TakeMatch = { fileId: string; take: string | null; confidence: "high" | "low" }`, `transcribeVideo(fileId: string, mimeType: string): Promise<string>`, `matchTakesToScript(description: string, transcripts: { fileId: string; name: string; transcript: string }[]): Promise<TakeMatch[]>` — ambas usadas pela Task 3.

- [ ] **Step 1: Instalar o SDK da Anthropic**

Run: `npm install @anthropic-ai/sdk`

- [ ] **Step 2: Criar `src/lib/videoTakes.ts`**

```ts
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
  form.append("file", new Blob([bytes], { type: mimeType }), "video");
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
            take: { type: ["string", "null"] as unknown as "string", description: "ex: 'take1' — ou null se não identificar" },
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
    .join("\n")}\n\nPra cada vídeo, identifique a qual take do roteiro ele corresponde (ex: "take1", "take2"). Se o roteiro não distinguir takes numerados, use a ordem em que aparecem no texto. "confidence": "high" só quando o conteúdo falado bater claramente com aquele trecho do roteiro; "low" (com "take": null se não der pra saber qual) em qualquer caso de dúvida — inclusive vídeo sem relação nenhuma com o roteiro.`;

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
  return input.matches;
}
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros. Se o `input_schema` de `MATCH_TOOL` der erro de tipo pelo `type: ["string","null"]`, simplifique pra `type: "string" as const` puro (o modelo já é instruído a usar string vazia/omitir quando não sabe — ajustar o parsing em `matchTakesToScript` se necessário, tratando string vazia como `null`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/videoTakes.ts package.json package-lock.json
git commit -m "feat(conteudos): transcrição (Groq Whisper) e matching de takes (Anthropic)"
```

---

### Task 3: Rota `POST .../videos/match-takes`

**Files:**
- Create: `src/app/api/content/[client]/card/[cardId]/videos/match-takes/route.ts`

**Interfaces:**
- Consumes: `verifyClientToken` de `src/lib/access.ts`; `CLIENTS` de `src/lib/clients.ts`; `findOrCreateClientFolder`, `findOrCreatePostFolder`, `listVideosInFolder`, `renameFile`, `hasGoogleDriveCredentials` de `src/lib/googleDrive.ts`; `hasVideoTakesCredentials`, `isAlreadyNamedAsTake`, `transcribeVideo`, `matchTakesToScript` de `src/lib/videoTakes.ts` (Task 2); `addComment` de `src/lib/trello.ts`; precisa também da **descrição do card** — não existe hoje uma função que busca só isso, então usar `trelloGet` indiretamente via uma nova função pequena `fetchCardDescription(cardId)` em `trello.ts` (reaproveita o padrão de `trelloGet`).
- Produces: `POST /api/content/[client]/card/[cardId]/videos/match-takes?key=...` com body `{ cardName: string }` → `{ processed: number; renamed: number }`.

- [ ] **Step 1: Adicionar `fetchCardDescription` em `src/lib/trello.ts`**

Logo depois de `fetchCardActivity`:

```ts
export async function fetchCardDescription(cardId: string): Promise<string> {
  const card: { desc: string } = await trelloGet(`cards/${cardId}`, { fields: "desc" });
  return card.desc;
}
```

- [ ] **Step 2: Criar `src/app/api/content/[client]/card/[cardId]/videos/match-takes/route.ts`**

```ts
// src/app/api/content/[client]/card/[cardId]/videos/match-takes/route.ts
import { NextRequest } from "next/server";
import { verifyClientToken } from "@/lib/access";
import { CLIENTS } from "@/lib/clients";
import { fetchCardDescription, addComment } from "@/lib/trello";
import {
  findOrCreateClientFolder,
  findOrCreatePostFolder,
  listVideosInFolder,
  renameFile,
  hasGoogleDriveCredentials,
} from "@/lib/googleDrive";
import { hasVideoTakesCredentials, isAlreadyNamedAsTake, transcribeVideo, matchTakesToScript } from "@/lib/videoTakes";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> }
) {
  const { client: clientId, cardId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasGoogleDriveCredentials() || !hasVideoTakesCredentials()) {
    console.error("[content] credenciais de Drive ou IA de takes não configuradas (match-takes)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const body = await request.json().catch(() => null);
  const cardName = body?.cardName;
  if (typeof cardName !== "string") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const clientName = CLIENTS.find((c) => c.id === clientId)?.name ?? clientId;

  try {
    const clientFolderId = await findOrCreateClientFolder(clientName);
    const postFolder = await findOrCreatePostFolder(clientFolderId, cardId, cardName);
    const videos = await listVideosInFolder(postFolder.id);
    const pending = videos.filter((v) => !isAlreadyNamedAsTake(v.name));

    if (pending.length === 0) {
      return Response.json({ processed: 0, renamed: 0 });
    }

    const description = await fetchCardDescription(cardId);

    const transcripts = await Promise.all(
      pending.map(async (v) => ({
        fileId: v.id,
        name: v.name,
        transcript: await transcribeVideo(v.id, "video/mp4").catch(() => ""),
      }))
    );

    const matches = await matchTakesToScript(description, transcripts);

    let renamed = 0;
    const lowConfidenceNames: string[] = [];
    for (const match of matches) {
      const video = pending.find((v) => v.id === match.fileId);
      if (!video) continue;
      if (match.confidence === "high" && match.take) {
        const ext = video.name.includes(".") ? video.name.slice(video.name.lastIndexOf(".")) : "";
        await renameFile(video.id, `${match.take}${ext}`);
        renamed++;
      } else {
        lowConfidenceNames.push(video.name);
      }
    }

    if (lowConfidenceNames.length > 0) {
      await addComment(
        cardId,
        `A identificação automática de takes não teve certeza sobre: ${lowConfidenceNames.join(", ")}. Confere manualmente qual take é qual.`
      );
    }

    return Response.json({ processed: pending.length, renamed });
  } catch (err) {
    console.error(`[content] falha ao identificar takes do card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificação ao vivo**

Com `npm run dev` rodando, um card de teste com roteiro na descrição e 1-2 vídeos já enviados (via UI da Fase 1):

```bash
curl -X POST "http://localhost:3000/api/content/tiago/card/<CARD_ID>/videos/match-takes?key=<TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"cardName":"TesteVerificacaoPlano"}'
```
Expected: `{"processed":N,"renamed":M}` — confira no Drive que os arquivos de alta confiança foram renomeados pra `take1.mp4` etc, e que os duvidosos (se houver) mantiveram o nome original e geraram um comentário no card do Trello.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/content/[client]/card/[cardId]/videos/match-takes src/lib/trello.ts
git commit -m "feat(conteudos): rota de identificação automática de takes via IA"
```

---

### Task 4: Disparo automático no frontend

**Files:**
- Modify: `src/components/ContentCardVideoField.tsx`

**Interfaces:**
- Consumes: rota da Task 3 (`POST .../videos/match-takes`).

- [ ] **Step 1: Disparar `match-takes` ao final do upload**

No `handleFilesSelected`, dentro do bloco `finally` (depois do `await refreshVideos()` já existente, sem bloquear o `finally` — dispara e re-consulta em paralelo com um pequeno estado de "processando"), adicionar chamada fire-and-forget que atualiza a lista de novo ao terminar:

```ts
// depois de "await refreshVideos();" dentro do finally:
fetch(`/api/content/${clientId}/card/${cardId}/videos/match-takes?key=${encodeURIComponent(accessKey)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cardName }),
})
  .then(() => refreshVideos())
  .catch(() => {
    // ponytail: falha silenciosa — vídeos ficam com nome original, sem travar a UI de upload.
  });
```

Adicionar também um estado leve `identifyingTakes` (setado `true` antes do `fetch`, `false` no `.then`/`.catch`) e exibir um texto pequeno tipo "Identificando takes..." abaixo da lista enquanto `true`, seguindo o mesmo padrão visual dos outros estados do componente (`error`, `progress`).

- [ ] **Step 2: Rodar `npx tsc --noEmit` e `npm run build`**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 3: Verificação ao vivo completa**

1. Card de teste com roteiro descrevendo 2 takes distintos na descrição.
2. Subir 2 vídeos correspondentes pela UI — confirmar que aparece "Identificando takes..." e, ao terminar, os nomes na lista mudam pra `take1.mp4`/`take2.mp4`.
3. Subir um vídeo sem relação nenhuma com o roteiro — confirmar que ele NÃO é renomeado e que aparece um comentário no card do Trello.
4. Reabrir o card e subir mais um vídeo (upload incremental) — confirmar que os já renomeados não são retranscritos (não geram custo/chamada de novo — verificar log/rede se necessário).
5. Limpeza: apagar a pasta de teste no Drive e o comentário de teste no Trello, se aplicável.

- [ ] **Step 4: Commit**

```bash
git add src/components/ContentCardVideoField.tsx
git commit -m "feat(conteudos): dispara identificação de takes automaticamente após upload"
```

## Verificação

- `npx tsc --noEmit` e `npm run build` limpos ao final da Task 4.
- Vídeos com match de alta confiança são renomeados pra `take<N>.<ext>` no Drive.
- Vídeos duvidosos/sem match mantêm nome original e geram comentário no Trello.
- Upload em si nunca quebra por causa de falha na IA (transcrição, matching ou rename).
- Vídeos já nomeados como take não são reprocessados em uploads incrementais.
