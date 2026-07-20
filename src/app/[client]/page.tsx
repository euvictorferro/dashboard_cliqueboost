import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { Dashboard } from "@/components/Dashboard";

export function generateStaticParams() {
  return CLIENTS.map((c) => ({ client: c.id }));
}

export default async function ClientPage({
  params,
}: {
  params: Promise<{ client: string }>;
}) {
  const { client } = await params;
  const found = CLIENTS.find((c) => c.id === client);
  if (!found) notFound();

  return <Dashboard client={found} />;
}
