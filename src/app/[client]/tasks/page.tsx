import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { AppFrame } from "@/components/AppFrame";
import { TasksPageClient } from "@/components/TasksPageClient";
import { verifyClientToken } from "@/lib/access";

export default async function ClientTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { client } = await params;
  const { key } = await searchParams;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientToken(found.id, key);
  if (!authorized) return <AccessDenied />;

  return (
    <AppFrame clientId={found.id} accessKey={key!} active="tasks" pageLabel="Tasks">
      <TasksPageClient clientId={found.id} accessKey={key!} />
    </AppFrame>
  );
}
