import { NextRequest } from "next/server";
import { verifyClientSession } from "@/lib/access";
import { CLIENTS } from "@/lib/clients";
import {
  findClientFolder,
  findPostFolder,
  listVideosInFolder,
  deleteFile,
  hasGoogleDriveCredentials,
} from "@/lib/googleDrive";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string; fileId: string }> }
) {
  const { client: clientId, cardId, fileId } = await params;

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasGoogleDriveCredentials()) {
    console.error("[content] GOOGLE_SERVICE_ACCOUNT_KEY/GOOGLE_DRIVE_CLIENTS_FOLDER_ID não configurados (videos delete)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const clientName = CLIENTS.find((c) => c.id === clientId)?.name ?? clientId;

  try {
    const clientFolderId = await findClientFolder(clientName);
    if (!clientFolderId) return Response.json({ error: "not_found" }, { status: 404 });
    const postFolder = await findPostFolder(clientFolderId, cardId);
    if (!postFolder) return Response.json({ error: "not_found" }, { status: 404 });
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
