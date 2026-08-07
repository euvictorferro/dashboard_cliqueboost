import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientSession } from "@/lib/access";
import { createBugReport } from "@/lib/bugReports";
import { getSupabaseAdmin } from "@/lib/supabase";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_SCREENSHOTS = 3;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT_BY_TYPE: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string }> }) {
  const { client: clientId } = await params;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ error: "invalid_body" }, { status: 400 });

  const page = formData.get("page");
  const description = formData.get("description");
  if (typeof page !== "string" || page.trim().length === 0) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const files = formData.getAll("screenshots").filter((f): f is File => f instanceof File);
  if (files.length > MAX_SCREENSHOTS) return Response.json({ error: "too_many_files" }, { status: 400 });
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "invalid_type" }, { status: 400 });
    if (file.size > MAX_SIZE_BYTES) return Response.json({ error: "too_large" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "fetch_failed" }, { status: 502 });

  try {
    const screenshotUrls: string[] = [];
    for (const file of files) {
      const ext = EXT_BY_TYPE[file.type];
      const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from("bug-report-screenshots")
        .upload(path, buffer, { contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage.from("bug-report-screenshots").getPublicUrl(path);
      screenshotUrls.push(data.publicUrl);
    }

    await createBugReport(clientId, page.trim(), description.trim(), screenshotUrls);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[bug-reports] falha ao salvar report de ${clientId}:`, err);
    return Response.json({ error: "fetch_failed" }, { status: 502 });
  }
}
