import { NextRequest } from "next/server";
import { CLIENTS } from "@/lib/clients";
import { verifyClientSession } from "@/lib/access";
import { fetchCallNote, markTasksExtracted } from "@/lib/callNotes";
import { extractTasksFromNote } from "@/lib/taskExtraction";
import { createTask } from "@/lib/clickup";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ client: string; id: string }> }) {
  const { client: clientId, id: noteId } = await params;

  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return Response.json({ error: "unknown_client" }, { status: 404 });
  if (!(await verifyClientSession(clientId))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!client.clickupListId) return Response.json({ error: "no_clickup_list" }, { status: 400 });
  if (!(await checkRateLimit(`extract-tasks:${clientId}`, 60 * 60, 20))) {
    return Response.json({ error: "too_many_requests" }, { status: 429 });
  }

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
