// src/app/[client]/atas/[id]/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { AtaDetailPageClient } from "@/components/AtaDetailPageClient";
import { verifyClientToken } from "@/lib/access";

export default async function ClientAtaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string; id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { client, id } = await params;
  const { key } = await searchParams;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  const authorized = await verifyClientToken(found.id, key);
  if (!authorized) return <AccessDenied />;

  return (
    <div className="flex min-h-full">
      <Sidebar clientId={found.id} accessKey={key!} active="atas" />
      <div className="min-w-0 flex-1">
        <AtaDetailPageClient clientId={found.id} accessKey={key!} noteId={id} />
      </div>
    </div>
  );
}
