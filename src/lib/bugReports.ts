// ponytail: server-only — nunca importar isto de um componente "use client" (usa a Service Role Key).
import { getSupabaseAdmin } from "./supabase";

export async function createBugReport(
  clientId: string,
  page: string,
  description: string,
  screenshotUrls: string[]
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("bug_reports")
    .insert({ client_id: clientId, page, description, screenshot_urls: screenshotUrls });
  if (error) throw new Error(error.message);
}
