import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { AppFrame } from "@/components/layout/AppFrame";
import { BoosterAiPageClient } from "@/components/booster-ai/BoosterAiPageClient";
import { verifyClientSession } from "@/lib/access";

export default async function ClientBoosterAiPage({
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
    <AppFrame clientId={found.id} active="booster-ai" pageLabel="Booster AI">
      <BoosterAiPageClient clientId={found.id} />
    </AppFrame>
  );
}
