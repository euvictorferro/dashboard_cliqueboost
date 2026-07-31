// src/app/[client]/conta/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { Sidebar } from "@/components/Sidebar";
import { ContaPageClient } from "@/components/ContaPageClient";
import { verifyClientToken } from "@/lib/access";

export default async function ClientContaPage({
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
      <Sidebar clientId={found.id} accessKey={key!} active="conta" />
      <div className="min-w-0 flex-1">
        <ContaPageClient clientId={found.id} clientName={found.name} accessKey={key!} />
      </div>
    </div>
  );
}
