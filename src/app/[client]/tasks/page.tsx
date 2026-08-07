import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { AppFrame } from "@/components/layout/AppFrame";
import { TasksPageClient } from "@/components/tasks/TasksPageClient";
import { verifyClientSession } from "@/lib/access";

export default async function ClientTasksPage({
  params,
}: {
  params: Promise<{ client: string }>;
}) {
  const { client } = await params;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientSession(found.id);
  if (!authorized) return <AccessDenied />;

  return (
    <AppFrame clientId={found.id} active="tasks" pageLabel="Tasks">
      <TasksPageClient clientId={found.id} />
    </AppFrame>
  );
}
