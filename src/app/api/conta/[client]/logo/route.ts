// src/app/api/conta/[client]/logo/route.ts
import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { updateClientLogo } from "@/lib/clientSettings";
import { verifyClientToken } from "@/lib/access";
import { getSupabaseAdmin } from "@/lib/supabase";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const EXT_BY_TYPE: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("logo");
  if (!(file instanceof File)) return Response.json({ error: "invalid_body" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "invalid_type" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return Response.json({ error: "too_large" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "fetch_failed" }, { status: 502 });

  const ext = EXT_BY_TYPE[file.type];
  const path = `${clientId}/logo.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("client-logos")
      .upload(path, buffer, { contentType: file.type, upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from("client-logos").getPublicUrl(path);
    await updateClientLogo(clientId, data.publicUrl);
    return Response.json({ logoUrl: data.publicUrl });
  } catch (err) {
    console.error(`[conta] falha ao subir logo de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
