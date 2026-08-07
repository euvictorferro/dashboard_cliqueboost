// src/app/[client]/conta/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { AccessDenied } from "@/components/AccessDenied";
import { AppFrame } from "@/components/AppFrame";
import { ContaPageClient } from "@/components/ContaPageClient";
import { verifyClientSession } from "@/lib/access";

export default async function ClientContaPage({
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
    <AppFrame clientId={found.id} active="conta" pageLabel="Conta">
      <ContaPageClient clientId={found.id} clientName={found.name} />
    </AppFrame>
  );
}
