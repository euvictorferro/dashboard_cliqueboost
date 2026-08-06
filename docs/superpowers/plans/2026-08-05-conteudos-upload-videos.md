# Conteúdos — Upload de Vídeos (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente sobe até 20 vídeos por post direto no card de Conteúdos; os arquivos vão pro Google Drive (pasta `Clientes/<cliente>/<post>`), e o editor recebe o link da pasta automaticamente como anexo no card do Trello.

**Architecture:** Task 1 cria a camada de acesso ao Google Drive (`googleDrive.ts`, mesmo padrão de service account do `googleCalendar.ts`, mas com escopo `drive`). Task 2 expõe isso via 3 rotas de API (`GET` lista, `POST /init` inicia upload resumível, `DELETE` remove). Task 3 adiciona a UI dentro do `ContentCardModal` já existente. Upload vai direto do navegador pro Drive — nosso servidor só negocia a sessão.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Google Drive API v3 (REST direto via `fetch`, sem SDK novo) — sem dependências novas.

## Global Constraints

- Upload vai direto do navegador pro Google Drive via URL de sessão resumível — nunca passa o arquivo pelo nosso servidor (limite de request da Vercel não se aplica).
- Máximo 20 vídeos por post — validado no backend (`POST .../init`) e refletido no frontend.
- Só aceita arquivos com `mimeType` começando em `video/` — validado no frontend (`accept="video/*"`) e no backend.
- Nome do arquivo preservado como veio do cliente — sem renomear (fase 2, com IA, cuida disso depois).
- Sem tabela nova no Supabase — o Google Drive é a fonte de verdade (mesmo padrão do Trello: sem cache local). O vínculo card↔pasta usa `appProperties.trelloCardId` no próprio Drive, robusto a renomeação do card.
- No primeiro vídeo enviado de um post, o link da pasta do Drive é adicionado automaticamente como anexo (link) no card do Trello via `addLinkAttachment` (já existe em `src/lib/trello.ts`) — só na primeira vez.
- Env vars já configuradas em Development/Preview/Production: `GOOGLE_SERVICE_ACCOUNT_KEY` (mesmo service account do Calendar, `clique-boost-app@clique-boost-app.iam.gserviceaccount.com`) e `GOOGLE_DRIVE_CLIENTS_FOLDER_ID=11gqARfhiX3DY8sllBYLB6PNSHyakWfl7` (pasta "Clientes", já compartilhada como Editor com o service account).
- Sem suíte de testes automatizada neste projeto (padrão já estabelecido) — verificação via `npx tsc --noEmit`, `npm run build`, e checagem ao vivo com o dev server.

---

### Task 1: `src/lib/googleDrive.ts` — acesso ao Google Drive

**Files:**
- Create: `src/lib/googleDrive.ts`

**Interfaces:**
- Consumes: `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_DRIVE_CLIENTS_FOLDER_ID` (env vars, já configuradas).
- Produces: `ContentVideo = { id: string; name: string; size: number; webViewLink: string }`, `hasGoogleDriveCredentials(): boolean`, `findOrCreateClientFolder(clientName: string): Promise<string>`, `findOrCreatePostFolder(clientFolderId: string, cardId: string, cardName: string): Promise<{ id: string; webViewLink: string; isNew: boolean }>`, `listVideosInFolder(folderId: string): Promise<ContentVideo[]>`, `initResumableUpload(folderId: string, fileName: string, mimeType: string, fileSize: number): Promise<string>`, `deleteFile(fileId: string): Promise<void>` — todas usadas pela Task 2.

- [ ] **Step 1: Criar `src/lib/googleDrive.ts`**

```ts
// src/lib/googleDrive.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa a chave da service account).
import { createSign } from "node:crypto";

export type ContentVideo = { id: string; name: string; size: number; webViewLink: string };

export function hasGoogleDriveCredentials(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) && Boolean(process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID);
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function getServiceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY não configurada");
  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY inválida");
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

async function getAccessToken(): Promise<string> {
  const { client_email, private_key } = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(private_key, "base64url");
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google_drive_auth_failed: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

function clientsFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID;
  if (!id) throw new Error("GOOGLE_DRIVE_CLIENTS_FOLDER_ID não configurada");
  return id;
}

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function driveFetch(path: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google_drive_failed: ${JSON.stringify(json)}`);
  return json;
}

export async function findOrCreateClientFolder(clientName: string): Promise<string> {
  const accessToken = await getAccessToken();
  const query = `name = '${escapeQueryValue(clientName)}' and '${clientsFolderId()}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const found = await driveFetch(`files?q=${encodeURIComponent(query)}&fields=files(id)`, accessToken);
  if (found.files?.[0]?.id) return found.files[0].id;

  const created = await driveFetch("files?fields=id", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: clientName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [clientsFolderId()],
    }),
  });
  return created.id;
}

export async function findOrCreatePostFolder(
  clientFolderId: string,
  cardId: string,
  cardName: string
): Promise<{ id: string; webViewLink: string; isNew: boolean }> {
  const accessToken = await getAccessToken();
  const query = `appProperties has { key='trelloCardId' and value='${escapeQueryValue(cardId)}' } and '${clientFolderId}' in parents and trashed = false`;
  const found = await driveFetch(`files?q=${encodeURIComponent(query)}&fields=files(id,webViewLink)`, accessToken);
  if (found.files?.[0]?.id) {
    return { id: found.files[0].id, webViewLink: found.files[0].webViewLink, isNew: false };
  }

  const created = await driveFetch("files?fields=id,webViewLink", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: cardName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [clientFolderId],
      appProperties: { trelloCardId: cardId },
    }),
  });
  return { id: created.id, webViewLink: created.webViewLink, isNew: true };
}

export async function listVideosInFolder(folderId: string): Promise<ContentVideo[]> {
  const accessToken = await getAccessToken();
  const query = `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`;
  const result = await driveFetch(
    `files?q=${encodeURIComponent(query)}&fields=files(id,name,size,webViewLink)&orderBy=name`,
    accessToken
  );
  return (result.files ?? []).map((f: { id: string; name: string; size?: string; webViewLink: string }) => ({
    id: f.id,
    name: f.name,
    size: f.size ? Number(f.size) : 0,
    webViewLink: f.webViewLink,
  }));
}

export async function initResumableUpload(
  folderId: string,
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<string> {
  const accessToken = await getAccessToken();
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(fileSize),
    },
    body: JSON.stringify({ name: fileName, parents: [folderId] }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`google_drive_resumable_init_failed: ${text}`);
  }
  const location = res.headers.get("Location");
  if (!location) throw new Error("google_drive_resumable_init_failed: sem header Location");
  return location;
}

export async function deleteFile(fileId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`google_drive_delete_failed: ${text}`);
  }
}
```

- [ ] **Step 2: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificação ao vivo (funções de leitura/criação)**

Run:
```bash
node -e '
const { createSign } = require("crypto");
const fs = require("fs");
const lines = fs.readFileSync(".env.local", "utf8").split("\n");
const saLine = lines.find(l => l.startsWith("GOOGLE_SERVICE_ACCOUNT_KEY="));
const sa = JSON.parse(saLine.slice("GOOGLE_SERVICE_ACCOUNT_KEY=".length).slice(1, -1));
const folderLine = lines.find(l => l.startsWith("GOOGLE_DRIVE_CLIENTS_FOLDER_ID="));
const folderId = folderLine.slice("GOOGLE_DRIVE_CLIENTS_FOLDER_ID=".length).replace(/^"|"$/g, "");

function base64url(input) { return Buffer.from(input).toString("base64url"); }

(async () => {
  const now = Math.floor(Date.now()/1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signingInput = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(sa.private_key, "base64url");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${signingInput}.${signature}` }) });
  const { access_token } = await tokenRes.json();

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", { method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: "TesteAutomatizadoPlano", mimeType: "application/vnd.google-apps.folder", parents: [folderId], appProperties: { trelloCardId: "test-card-plano" } }) });
  const created = await createRes.json();
  console.log("pasta criada:", created);

  await fetch(`https://www.googleapis.com/drive/v3/files/${created.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${access_token}` } });
  console.log("pasta de teste removida");
})();
'
```
Expected: imprime a pasta criada (com `id` e `webViewLink`) e depois confirma a remoção — sem erros. Se der erro `403`, confirme que a pasta "Clientes" foi mesmo compartilhada como Editor com `clique-boost-app@clique-boost-app.iam.gserviceaccount.com`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/googleDrive.ts
git commit -m "feat(conteudos): camada de acesso ao Google Drive para upload de vídeos"
```

---

### Task 2: Rotas de API — listar, iniciar upload e remover vídeo

**Files:**
- Create: `src/app/api/content/[client]/card/[cardId]/videos/route.ts`
- Create: `src/app/api/content/[client]/card/[cardId]/videos/init/route.ts`
- Create: `src/app/api/content/[client]/card/[cardId]/videos/[fileId]/route.ts`

**Interfaces:**
- Consumes: `hasGoogleDriveCredentials`, `findOrCreateClientFolder`, `findOrCreatePostFolder`, `listVideosInFolder`, `initResumableUpload`, `deleteFile`, `ContentVideo` de `src/lib/googleDrive.ts` (Task 1); `verifyClientToken` de `src/lib/access.ts` (já existe); `CLIENTS` de `src/lib/clients.ts` (já existe); `addLinkAttachment` de `src/lib/trello.ts` (já existe).
- Produces: `GET /api/content/[client]/card/[cardId]/videos?key=...&cardName=...` → `{ videos: ContentVideo[] }`. `POST /api/content/[client]/card/[cardId]/videos/init?key=...` com body `{ fileName, mimeType, fileSize, cardName }` → `{ uploadUrl: string }`. `DELETE /api/content/[client]/card/[cardId]/videos/[fileId]?key=...&cardName=...` → `{ ok: true }`.

- [ ] **Step 1: Criar `src/app/api/content/[client]/card/[cardId]/videos/route.ts`**

```ts
// src/app/api/content/[client]/card/[cardId]/videos/route.ts
import { NextRequest } from "next/server";
import { verifyClientToken } from "@/lib/access";
import { CLIENTS } from "@/lib/clients";
import { findOrCreateClientFolder, findOrCreatePostFolder, listVideosInFolder, hasGoogleDriveCredentials } from "@/lib/googleDrive";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> }
) {
  const { client: clientId, cardId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;
  const cardName = request.nextUrl.searchParams.get("cardName") ?? cardId;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasGoogleDriveCredentials()) {
    console.error("[content] GOOGLE_SERVICE_ACCOUNT_KEY/GOOGLE_DRIVE_CLIENTS_FOLDER_ID não configurados (videos)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const clientName = CLIENTS.find((c) => c.id === clientId)?.name ?? clientId;

  try {
    const clientFolderId = await findOrCreateClientFolder(clientName);
    const postFolder = await findOrCreatePostFolder(clientFolderId, cardId, cardName);
    const videos = await listVideosInFolder(postFolder.id);
    return Response.json({ videos });
  } catch (err) {
    console.error(`[content] falha ao listar vídeos do card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Criar `src/app/api/content/[client]/card/[cardId]/videos/init/route.ts`**

```ts
// src/app/api/content/[client]/card/[cardId]/videos/init/route.ts
import { NextRequest } from "next/server";
import { verifyClientToken } from "@/lib/access";
import { CLIENTS } from "@/lib/clients";
import { addLinkAttachment } from "@/lib/trello";
import {
  findOrCreateClientFolder,
  findOrCreatePostFolder,
  listVideosInFolder,
  initResumableUpload,
  hasGoogleDriveCredentials,
} from "@/lib/googleDrive";

const MAX_VIDEOS_PER_POST = 20;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> }
) {
  const { client: clientId, cardId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasGoogleDriveCredentials()) {
    console.error("[content] GOOGLE_SERVICE_ACCOUNT_KEY/GOOGLE_DRIVE_CLIENTS_FOLDER_ID não configurados (videos/init)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const body = await request.json().catch(() => null);
  const fileName = body?.fileName;
  const mimeType = body?.mimeType;
  const fileSize = body?.fileSize;
  const cardName = body?.cardName;
  if (
    typeof fileName !== "string" ||
    typeof mimeType !== "string" ||
    !mimeType.startsWith("video/") ||
    typeof fileSize !== "number" ||
    typeof cardName !== "string"
  ) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const clientName = CLIENTS.find((c) => c.id === clientId)?.name ?? clientId;

  try {
    const clientFolderId = await findOrCreateClientFolder(clientName);
    const postFolder = await findOrCreatePostFolder(clientFolderId, cardId, cardName);

    const existing = await listVideosInFolder(postFolder.id);
    if (existing.length >= MAX_VIDEOS_PER_POST) {
      return Response.json({ error: "max_videos_reached" }, { status: 400 });
    }

    if (postFolder.isNew) {
      await addLinkAttachment(cardId, postFolder.webViewLink);
    }

    const uploadUrl = await initResumableUpload(postFolder.id, fileName, mimeType, fileSize);
    return Response.json({ uploadUrl });
  } catch (err) {
    console.error(`[content] falha ao iniciar upload de vídeo no card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Criar `src/app/api/content/[client]/card/[cardId]/videos/[fileId]/route.ts`**

```ts
// src/app/api/content/[client]/card/[cardId]/videos/[fileId]/route.ts
import { NextRequest } from "next/server";
import { verifyClientToken } from "@/lib/access";
import { CLIENTS } from "@/lib/clients";
import {
  findOrCreateClientFolder,
  findOrCreatePostFolder,
  listVideosInFolder,
  deleteFile,
  hasGoogleDriveCredentials,
} from "@/lib/googleDrive";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string; fileId: string }> }
) {
  const { client: clientId, cardId, fileId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;
  const cardName = request.nextUrl.searchParams.get("cardName") ?? cardId;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasGoogleDriveCredentials()) {
    console.error("[content] GOOGLE_SERVICE_ACCOUNT_KEY/GOOGLE_DRIVE_CLIENTS_FOLDER_ID não configurados (videos delete)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const clientName = CLIENTS.find((c) => c.id === clientId)?.name ?? clientId;

  try {
    const clientFolderId = await findOrCreateClientFolder(clientName);
    const postFolder = await findOrCreatePostFolder(clientFolderId, cardId, cardName);
    const videos = await listVideosInFolder(postFolder.id);
    if (!videos.some((v) => v.id === fileId)) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    await deleteFile(fileId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[content] falha ao remover vídeo ${fileId} do card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Rodar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Verificação ao vivo da rota GET**

Pegue um token de cliente real pra teste: no SQL Editor do Supabase, rode `select token from client_tokens where client_id = 'tiago';` e copie o valor.

Run (com o dev server rodando em outro terminal via `npm run dev`, e substituindo `<TOKEN>` e `<CARD_ID>` por um card real do board do Tiago no Trello):
```bash
curl "http://localhost:3000/api/content/tiago/card/<CARD_ID>/videos?key=<TOKEN>&cardName=TesteVerificacaoPlano"
```
Expected: `{"videos":[]}` — e uma pasta `Clientes/Tiago Zamboni/TesteVerificacaoPlano` aparece no Drive.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/content/[client]/card/[cardId]/videos
git commit -m "feat(conteudos): rotas de listar, iniciar upload e remover vídeo (Google Drive)"
```

---

### Task 3: UI — seção "Vídeos" no card de Conteúdos

**Files:**
- Create: `src/components/ContentCardVideoField.tsx`
- Modify: `src/components/ContentCardModal.tsx` (exportar `Field`, importar e renderizar `VideoUploadField`)

**Interfaces:**
- Consumes: rotas da Task 2 (`GET/POST/DELETE .../videos...`); `Field` exportado de `ContentCardModal.tsx`; `AttachmentIcon`, `TrashIcon` de `./icons`.
- Produces: `VideoUploadField({ clientId, accessKey, cardId, cardName }): JSX.Element`, renderizado dentro do `ContentCardModal`.

- [ ] **Step 1: Exportar `Field` em `src/components/ContentCardModal.tsx`**

Leia o arquivo primeiro para confirmar a linha exata (hoje é `function Field({` por volta da linha 78). Troque:
```ts
function Field({
```
por:
```ts
export function Field({
```

- [ ] **Step 2: Criar `src/components/ContentCardVideoField.tsx`**

```tsx
// src/components/ContentCardVideoField.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "./ContentCardModal";
import { AttachmentIcon, TrashIcon } from "./icons";
import type { ContentVideo } from "@/lib/googleDrive";

const MAX_VIDEOS_PER_POST = 20;

function formatSize(bytes: number): string {
  if (bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)}GB` : `${mb.toFixed(1)}MB`;
}

function uploadWithProgress(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload_failed_${xhr.status}`)));
    xhr.onerror = () => reject(new Error("upload_network_error"));
    xhr.send(file);
  });
}

export function VideoUploadField({
  clientId,
  accessKey,
  cardId,
  cardName,
}: {
  clientId: string;
  accessKey: string;
  cardId: string;
  cardName: string;
}) {
  const [videos, setVideos] = useState<ContentVideo[] | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function videosUrl(): string {
    return `/api/content/${clientId}/card/${cardId}/videos?key=${encodeURIComponent(accessKey)}&cardName=${encodeURIComponent(cardName)}`;
  }

  async function refreshVideos() {
    const res = await fetch(videosUrl());
    if (!res.ok) return;
    const data: { videos: ContentVideo[] } = await res.json();
    setVideos(data.videos);
  }

  useEffect(() => {
    refreshVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  async function handleFilesSelected(fileList: FileList) {
    const files = Array.from(fileList);
    setError(null);

    if (files.some((f) => !f.type.startsWith("video/"))) {
      setError("Só é possível enviar arquivos de vídeo.");
      return;
    }
    if ((videos?.length ?? 0) + files.length > MAX_VIDEOS_PER_POST) {
      setError(`Máximo de ${MAX_VIDEOS_PER_POST} vídeos por post.`);
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        setProgress((prev) => ({ ...prev, [file.name]: 0 }));
        const initRes = await fetch(`/api/content/${clientId}/card/${cardId}/videos/init?key=${encodeURIComponent(accessKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size, cardName }),
        });
        if (!initRes.ok) throw new Error("init_failed");
        const { uploadUrl } = await initRes.json();
        await uploadWithProgress(uploadUrl, file, (percent) => setProgress((prev) => ({ ...prev, [file.name]: percent })));
      }
      await refreshVideos();
    } catch {
      setError("Não foi possível enviar um dos vídeos. Tenta de novo.");
    } finally {
      setUploading(false);
      setProgress({});
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(video: ContentVideo) {
    setVideos((prev) => (prev ? prev.filter((v) => v.id !== video.id) : prev));
    try {
      const res = await fetch(
        `/api/content/${clientId}/card/${cardId}/videos/${video.id}?key=${encodeURIComponent(accessKey)}&cardName=${encodeURIComponent(cardName)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
    } catch {
      await refreshVideos();
    }
  }

  const atLimit = (videos?.length ?? 0) >= MAX_VIDEOS_PER_POST;

  return (
    <Field
      label="Vídeos"
      icon={<AttachmentIcon size={14} />}
      action={
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || atLimit}
          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {uploading ? "Enviando..." : "Adicionar"}
        </button>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
      />
      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
      {Object.entries(progress).map(([name, percent]) => (
        <div key={name} className="mb-1 text-xs text-muted-foreground">
          {name}: {percent}%
        </div>
      ))}
      {videos === null ? (
        <span className="text-muted-foreground">Carregando...</span>
      ) : videos.length === 0 ? (
        <span className="text-muted-foreground">Nenhum vídeo enviado ainda</span>
      ) : (
        <ul className="space-y-2">
          {videos.map((video) => (
            <li key={video.id} className="flex items-center justify-between gap-2 text-xs">
              <a href={video.webViewLink} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 underline">
                {video.name}
              </a>
              <span className="shrink-0 text-muted-foreground">{formatSize(video.size)}</span>
              <button
                type="button"
                onClick={() => handleDelete(video)}
                aria-label="Remover"
                className="shrink-0 text-muted-foreground hover:text-red-500"
              >
                <TrashIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
```

- [ ] **Step 3: Renderizar `VideoUploadField` dentro do `ContentCardModal`**

Leia `src/components/ContentCardModal.tsx` primeiro pra confirmar o bloco exato do `<AttachmentsField .../>` (hoje por volta da linha 1220-1227, dentro de `<div className="space-y-6">`). Adicione o import no topo do arquivo:

```ts
import { VideoUploadField } from "./ContentCardVideoField";
```

E logo depois do bloco `<AttachmentsField ... />`, adicione:

```tsx
<VideoUploadField clientId={clientId} accessKey={accessKey} cardId={card.id} cardName={card.name} />
```

- [ ] **Step 4: Rodar `npx tsc --noEmit` e `npm run build`**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 5: Verificação ao vivo completa**

Com `npm run dev` rodando:
1. Abra `http://localhost:3000/tiago/conteudos?key=<TOKEN>` (mesmo token do Step 5 da Task 2), clique num card pra abrir o modal.
2. Confirme que aparece a seção "Vídeos" (vazia) abaixo de "Anexos".
3. Clique "Adicionar", selecione 2 arquivos de vídeo pequenos (ex: `.mp4` de poucos MB) do seu computador.
4. Confirme que aparece a barra de progresso de cada um e, ao terminar, os dois aparecem na lista com nome e tamanho.
5. Abra o card correspondente no Trello (mesmo board) e confirme que o link da pasta do Drive apareceu como anexo — só uma vez, mesmo com 2 vídeos enviados.
6. Clique no nome de um vídeo na lista e confirme que abre o arquivo no Google Drive.
7. Clique no ícone de remover num vídeo e confirme que ele some da lista e do Drive.
8. Tente selecionar um arquivo não-vídeo (ex: `.pdf`) e confirme a mensagem de erro "Só é possível enviar arquivos de vídeo.".
9. Limpeza: apague manualmente a pasta de teste `Clientes/Tiago Zamboni/TesteVerificacaoPlano` (e a criada neste teste, se usou um nome de card diferente) direto no Google Drive.

- [ ] **Step 6: Commit**

```bash
git add src/components/ContentCardVideoField.tsx src/components/ContentCardModal.tsx
git commit -m "feat(conteudos): seção Vídeos no card, upload direto pro Google Drive"
```

## Verificação

- `npx tsc --noEmit` e `npm run build` limpos ao final da Task 3.
- Upload de até 20 vídeos por post funciona, bloqueia no 21º.
- Só aceita arquivos de vídeo.
- Pasta `Clientes/<cliente>/<post>` criada automaticamente no Drive, robusta a renomeação do card (por causa do `appProperties`).
- Link da pasta aparece como anexo no card do Trello, uma única vez, no primeiro upload.
- Remover vídeo pela lista remove de verdade do Drive.
