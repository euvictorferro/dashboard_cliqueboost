// src/app/api/content/[client]/cover-proxy/route.ts
import { NextRequest } from "next/server";
import { verifyClientToken } from "@/lib/access";

const TRELLO_ATTACHMENT_URL_PREFIX = "https://trello.com/1/cards/";

export async function GET(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;
  const url = request.nextUrl.searchParams.get("url");

  if (!(await verifyClientToken(clientId, key))) {
    return new Response("unauthorized", { status: 401 });
  }

  if (!url || !url.startsWith(TRELLO_ATTACHMENT_URL_PREFIX)) {
    return new Response("invalid url", { status: 400 });
  }

  if (!process.env.TRELLO_API_KEY || !process.env.TRELLO_TOKEN) {
    // ponytail: distinto de "not found" só nos logs — pro navegador ambos viram a capa
    // desaparecendo silenciosamente (onError do <img>), mesma filosofia da rota /api/content.
    console.error("[content] TRELLO_API_KEY/TRELLO_TOKEN não configurados (cover-proxy)");
    return new Response("not found", { status: 404 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `OAuth oauth_consumer_key="${process.env.TRELLO_API_KEY}", oauth_token="${process.env.TRELLO_TOKEN}"`,
      },
      cache: "no-store",
    });
    if (!res.ok || !res.body) {
      return new Response("not found", { status: 404 });
    }
    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/webp",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error(`[content] falha ao buscar capa via proxy pra ${clientId}:`, err);
    return new Response("not found", { status: 404 });
  }
}
