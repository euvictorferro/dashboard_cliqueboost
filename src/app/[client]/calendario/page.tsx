import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { AppFrame } from "@/components/AppFrame";
import { CalendarPageClient } from "@/components/CalendarPageClient";
import { TimeZoneProvider } from "@/components/TimeZoneContext";
import { verifyClientToken } from "@/lib/access";
import { fetchClientSettings } from "@/lib/clientSettings";

export default async function ClientCalendarPage({
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

  const { timeZone } = await fetchClientSettings(found.id);

  return (
    <AppFrame clientId={found.id} accessKey={key!} active="calendario" pageLabel="Calendário">
      <TimeZoneProvider timeZone={timeZone}>
        <CalendarPageClient clientId={found.id} accessKey={key!} />
      </TimeZoneProvider>
    </AppFrame>
  );
}
