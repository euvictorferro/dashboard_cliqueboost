import { NextRequest } from "next/server";
import { verifyClientSession } from "@/lib/access";
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

  if (!(await verifyClientSession(clientId))) {
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
  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

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

    const uploadUrl = await initResumableUpload(postFolder.id, fileName, mimeType, fileSize, origin);
    return Response.json({ uploadUrl });
  } catch (err) {
    console.error(`[content] falha ao iniciar upload de vídeo no card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
