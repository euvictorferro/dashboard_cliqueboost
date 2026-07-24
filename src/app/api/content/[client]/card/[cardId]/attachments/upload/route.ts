import { NextRequest } from "next/server";
import { addFileAttachment, hasTrelloCredentials } from "@/lib/trello";
import { verifyClientToken } from "@/lib/access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ client: string; cardId: string }> },
) {
  const { client: clientId, cardId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  if (!(await verifyClientToken(clientId, key))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasTrelloCredentials()) {
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (upload)");
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const attachment = await addFileAttachment(cardId, file);
    return Response.json({ attachment });
  } catch (err) {
    console.error(`[content] falha ao subir arquivo no card ${cardId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
