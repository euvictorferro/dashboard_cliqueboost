// src/app/[client]/atas/[id]/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { AppFrame } from "@/components/layout/AppFrame";
import { AtaDetailPageClient } from "@/components/atas/AtaDetailPageClient";
import { TimeZoneProvider } from "@/components/layout/TimeZoneContext";
import { verifyClientSession } from "@/lib/access";
import { fetchClientSettings } from "@/lib/clientSettings";

export default async function ClientAtaDetailPage({
  params,
}: {
  params: Promise<{ client: string; id: string }>;
}) {
  const { client, id } = await params;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientSession(found.id);
  if (!authorized) return <AccessDenied />;

  const { timeZone } = await fetchClientSettings(found.id);

  return (
    <AppFrame clientId={found.id} active="atas" pageLabel="Atas">
      <TimeZoneProvider timeZone={timeZone}>
        <AtaDetailPageClient clientId={found.id} noteId={id} />
      </TimeZoneProvider>
    </AppFrame>
  );
}
