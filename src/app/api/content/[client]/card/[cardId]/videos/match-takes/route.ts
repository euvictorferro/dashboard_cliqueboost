// src/app/api/content/[client]/card/[cardId]/videos/match-takes/route.ts
import { NextRequest } from "next/server";
import { verifyClientSession } from "@/lib/access";
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
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> }
) {
  const { client: clientId, cardId } = await params;

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await checkRateLimit(`match-takes:${clientId}`, 60 * 60, 20))) {
    return Response.json({ error: "too_many_requests" }, { status: 429 });
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
