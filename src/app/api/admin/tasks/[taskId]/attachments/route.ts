import { verifyAdminRequest } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabase";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export async function GET(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { taskId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });
  const { data, error } = await supabase
    .from("task_attachments")
    .select("id, storage_path, filename, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: "fetch_failed" }, { status: 502 });
  const attachments = (data ?? []).map((a) => ({
    id: a.id,
    filename: a.filename,
    createdAt: a.created_at,
    url: supabase.storage.from("task-attachments").getPublicUrl(a.storage_path).data.publicUrl,
  }));
  return Response.json({ attachments });
}

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { taskId } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "invalid_body" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return Response.json({ error: "too_large" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });

  const path = `${taskId}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("task-attachments")
    .upload(path, buffer, { contentType: file.type || "application/octet-stream" });
  if (uploadError) return Response.json({ error: "upload_failed", detail: uploadError.message }, { status: 502 });

  const { data, error } = await supabase
    .from("task_attachments")
    .insert({ task_id: taskId, storage_path: path, filename: file.name, uploaded_by_admin_user_id: admin.adminUserId })
    .select("id, storage_path, filename, created_at")
    .single();
  if (error || !data) return Response.json({ error: "falha_registrar_anexo" }, { status: 502 });

  return Response.json({
    attachment: {
      id: data.id,
      filename: data.filename,
      createdAt: data.created_at,
      url: supabase.storage.from("task-attachments").getPublicUrl(data.storage_path).data.publicUrl,
    },
  });
}
