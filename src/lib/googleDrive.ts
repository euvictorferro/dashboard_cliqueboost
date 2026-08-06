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
