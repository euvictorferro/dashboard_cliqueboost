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
