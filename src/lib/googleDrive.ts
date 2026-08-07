// src/lib/googleDrive.ts
// ponytail: server-only — nunca importar isto de um componente "use client" (usa credenciais OAuth).
//
// Usa OAuth (refresh token da conta pessoal do Victor), não service account: contas de serviço
// não têm cota de armazenamento própria no Drive (erro "storageQuotaExceeded" ao subir arquivo,
// mesmo dentro de uma pasta compartilhada) — só funcionam pra metadata (listar/criar pasta), não
// pra upload de conteúdo real. Upgrade se algum dia migrar pra Google Workspace: trocar por um
// Shared Drive + voltar pra service account, que aí tem cota da organização.
export type ContentVideo = { id: string; name: string; size: number; webViewLink: string };

export function hasGoogleDriveCredentials(): boolean {
  return (
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_OAUTH_CLIENT_SECRET) &&
    Boolean(process.env.GOOGLE_OAUTH_REFRESH_TOKEN) &&
    Boolean(process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID)
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - now > 300) return cachedToken.token;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET/GOOGLE_OAUTH_REFRESH_TOKEN não configurados");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google_drive_auth_failed: ${JSON.stringify(json)}`);
  cachedToken = { token: json.access_token, expiresAt: now + json.expires_in };
  return cachedToken.token;
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

function clientFolderQuery(clientName: string): string {
  return `name = '${escapeQueryValue(clientName)}' and '${clientsFolderId()}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
}

function postFolderQuery(clientFolderId: string, cardId: string): string {
  return `appProperties has { key='trelloCardId' and value='${escapeQueryValue(cardId)}' } and '${clientFolderId}' in parents and trashed = false`;
}

export async function findClientFolder(clientName: string): Promise<string | null> {
  const accessToken = await getAccessToken();
  const found = await driveFetch(`files?q=${encodeURIComponent(clientFolderQuery(clientName))}&fields=files(id)`, accessToken);
  return found.files?.[0]?.id ?? null;
}

export async function findPostFolder(
  clientFolderId: string,
  cardId: string
): Promise<{ id: string; webViewLink: string } | null> {
  const accessToken = await getAccessToken();
  const found = await driveFetch(
    `files?q=${encodeURIComponent(postFolderQuery(clientFolderId, cardId))}&fields=files(id,webViewLink)`,
    accessToken
  );
  if (!found.files?.[0]?.id) return null;
  return { id: found.files[0].id, webViewLink: found.files[0].webViewLink };
}

export async function findOrCreateClientFolder(clientName: string): Promise<string> {
  const accessToken = await getAccessToken();
  const found = await driveFetch(`files?q=${encodeURIComponent(clientFolderQuery(clientName))}&fields=files(id)`, accessToken);
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
  const found = await driveFetch(
    `files?q=${encodeURIComponent(postFolderQuery(clientFolderId, cardId))}&fields=files(id,webViewLink)`,
    accessToken
  );
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
  fileSize: number,
  origin: string
): Promise<string> {
  const accessToken = await getAccessToken();
  // ponytail: o Drive só habilita CORS numa sessão resumível se a requisição que a CRIA já
  // tiver o header Origin do navegador que vai fazer o PUT depois — sem isso o upload direto
  // do navegador é bloqueado por CORS (testado ao vivo).
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(fileSize),
      Origin: origin,
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
