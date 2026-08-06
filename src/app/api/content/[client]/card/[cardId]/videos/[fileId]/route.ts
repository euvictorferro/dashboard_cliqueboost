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
