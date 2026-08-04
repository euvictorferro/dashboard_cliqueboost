import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { AppFrame } from "@/components/AppFrame";
import { BoosterAiPageClient } from "@/components/BoosterAiPageClient";
import { verifyClientToken } from "@/lib/access";

export default async function ClientBoosterAiPage({
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
    <AppFrame clientId={found.id} accessKey={key!} active="booster-ai" pageLabel="Booster AI">
      <BoosterAiPageClient clientId={found.id} accessKey={key!} />
    </AppFrame>
  );
}
