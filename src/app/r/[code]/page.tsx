// src/app/r/[code]/page.tsx
// ponytail: esquema simples — o link de indicação manda direto pro WhatsApp com o nome de quem
// indicou, sem formulário de captura. Não cria linha em referral_leads ainda (isso volta quando
// a gente aplicar o workflow completo de indicação); por ora é só o atalho pro WhatsApp.
import { redirect, notFound } from "next/navigation";
import { CLIENTS } from "@/lib/clients";
import { WHATSAPP_LINK } from "@/lib/ads";

export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const client = CLIENTS.find((c) => c.id === code);
  if (!client) notFound();

  const message = `Olá, tudo bem? ${client.name} me mandou seu link e gostaria de saber mais sobre o serviço.`;
  redirect(`${WHATSAPP_LINK}?text=${encodeURIComponent(message)}`);
}
