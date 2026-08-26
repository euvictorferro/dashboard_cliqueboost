import { verifyAdminRequest } from "@/lib/adminSession";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function DELETE(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const admin = await verifyAdminRequest();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { attachmentId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "supabase_nao_configurado" }, { status: 500 });

  const { data: attachment } = await supabase
    .from("task_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (attachment) await supabase.storage.from("task-attachments").remove([attachment.storage_path]);
  await supabase.from("task_attachments").delete().eq("id", attachmentId);
  return Response.json({ ok: true });
}
