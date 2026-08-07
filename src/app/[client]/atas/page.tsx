// src/app/[client]/atas/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { AppFrame } from "@/components/layout/AppFrame";
import { AtasPageClient } from "@/components/atas/AtasPageClient";
import { TimeZoneProvider } from "@/components/layout/TimeZoneContext";
import { verifyClientSession } from "@/lib/access";
import { fetchClientSettings } from "@/lib/clientSettings";

export default async function ClientAtasPage({
  params,
}: {
  params: Promise<{ client: string }>;
}) {
  const { client } = await params;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientSession(found.id);
  if (!authorized) return <AccessDenied />;

  const { timeZone } = await fetchClientSettings(found.id);

  return (
    <AppFrame clientId={found.id} active="atas" pageLabel="Atas">
      <TimeZoneProvider timeZone={timeZone}>
        <AtasPageClient clientId={found.id} />
      </TimeZoneProvider>
    </AppFrame>
  );
}
