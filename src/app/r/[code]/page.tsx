// src/app/r/[code]/page.tsx
import { notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { Logo } from "@/components/layout/Logo";
import { ReferralLeadForm } from "@/components/referral/ReferralLeadForm";

export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const client = CLIENTS.find((c) => c.id === code);
  if (!client) notFound();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-4 px-4 py-16">
      <Logo />
      <h1 className="mt-4 text-xl font-semibold text-foreground">Você foi indicado pela Clique Boost</h1>
      <p className="text-sm text-muted-foreground">
        {client.name} te indicou pra gente. Deixa seu contato que alguém da equipe te chama.
      </p>
      <ReferralLeadForm referrerClientId={client.id} />
    </div>
  );
}
