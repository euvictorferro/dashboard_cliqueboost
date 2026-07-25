import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { BunkerPageClient } from "@/components/BunkerPageClient";
import { verifyClientToken } from "@/lib/access";

export default async function ClientBunkerPage({
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
    <div className="flex min-h-full">
      <Sidebar clientId={found.id} accessKey={key!} active="bunker" />
      <div className="min-w-0 flex-1">
        <BunkerPageClient clientId={found.id} accessKey={key!} />
      </div>
    </div>
  );
}
