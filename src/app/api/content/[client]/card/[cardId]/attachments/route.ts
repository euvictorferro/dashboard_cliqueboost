import { NextRequest } from "next/server";
import { addLinkAttachment, hasTrelloCredentials } from "@/lib/trello";
import { verifyClientSession } from "@/lib/access";
import { DEMO_CLIENT_ID } from "@/lib/demoData";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> },
) {
  const { client: clientId, cardId } = await params;

  if (!(await verifyClientSession(clientId))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (clientId === DEMO_CLIENT_ID) {
    return Response.json({
      attachment: { name: "anexo-demo", url: "https://example.com", isUpload: false, previewUrl: null, largePreviewUrl: null, date: Date.now() },
    });
  }
  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (add attachment)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const { url } = await request.json();
  if (typeof url !== "string" || !url.trim()) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const attachment = await addLinkAttachment(cardId, url.trim());
    return Response.json({ attachment });
  } catch (err) {
    console.error(`[content] falha ao anexar link no card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
