import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientToken } from "@/lib/access";
import { fetchCallNote, markTasksExtracted } from "@/lib/callNotes";
import { extractTasksFromNote } from "@/lib/taskExtraction";
import { createTask } from "@/lib/clickup";

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string; id: string }> }) {
  const { client: clientId, id: noteId } = await params;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientToken(clientId, key))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!client.clickupListId) return Response.json({ error: "no_clickup_list" }, { status: 400 });

  try {
    const note = await fetchCallNote(clientId, noteId);
    if (!note) return Response.json({ error: "not_found" }, { status: 404 });

    const tasks = await extractTasksFromNote(note.content);
    for (const task of tasks) {
      await createTask(client.clickupListId, task.title, task.description);
    }
    await markTasksExtracted(clientId, noteId);

    return Response.json({ created: tasks.length });
  } catch (err) {
    console.error(`[atas/extract-tasks] falha ao extrair tasks da ata ${noteId} de ${clientId}:`, err);
    return Response.json({ error: "extract_failed" }, { status: 502 });
  }
}
