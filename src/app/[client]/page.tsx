import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { Dashboard } from "@/components/Dashboard";
import { AccessDenied } from "@/components/AccessDenied";
import { AppFrame } from "@/components/AppFrame";
import { verifyClientSession } from "@/lib/access";

export default async function ClientPage({
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
    <AppFrame clientId={found.id} active="dashboard" pageLabel="Dashboard">
      <Dashboard client={found} />
    </AppFrame>
  );
}
