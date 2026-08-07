import { NextRequest } from "next/server";
import { verifyClientSession } from "@/lib/access";
import { CLIENTS } from "@/lib/clients";
import { findClientFolder, findPostFolder, listVideosInFolder, hasGoogleDriveCredentials } from "@/lib/googleDrive";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> }
) {
  const { client: clientId, cardId } = await params;

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasGoogleDriveCredentials()) {
    console.error("[content] GOOGLE_SERVICE_ACCOUNT_KEY/GOOGLE_DRIVE_CLIENTS_FOLDER_ID não configurados (videos)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const clientName = CLIENTS.find((c) => c.id === clientId)?.name ?? clientId;

  try {
    const clientFolderId = await findClientFolder(clientName);
    if (!clientFolderId) return Response.json({ videos: [] });
    const postFolder = await findPostFolder(clientFolderId, cardId);
    if (!postFolder) return Response.json({ videos: [] });
    const videos = await listVideosInFolder(postFolder.id);
    return Response.json({ videos });
  } catch (err) {
    console.error(`[content] falha ao listar vídeos do card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
