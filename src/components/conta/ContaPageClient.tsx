"use client";

import { useEffect, useRef, useState } from "react";
import { ContaSidebar } from "@/components/conta/ContaSidebar";
import { ContaPerfilSection } from "@/components/conta/ContaPerfilSection";
import { ContaFusoSection } from "@/components/conta/ContaFusoSection";
import { ContaFaturamentoSection, type Payment } from "@/components/conta/ContaFaturamentoSection";
import { ContaIndicacoesSection, type ReferralLead } from "@/components/conta/ContaIndicacoesSection";
import { ContaSegurancaSection } from "@/components/conta/ContaSegurancaSection";

type Status = "loading" | "error" | "ready";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ContaPageClient({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [status, setStatus] = useState<Status>("loading");

  const [timeZone, setTimeZone] = useState<string>("America/New_York");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const [contactEmail, setContactEmail] = useState<string>("");
  const [emailSaveStatus, setEmailSaveStatus] = useState<SaveStatus>("idle");

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<SaveStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [planName, setPlanName] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contractDuration, setContractDuration] = useState<string>("Ainda não configurado");

  const [referralLeads, setReferralLeads] = useState<ReferralLead[]>([]);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const referralLink = typeof window !== "undefined" ? `${window.location.origin}/r/${clientId}` : "";

  function handleCopyLink() {
    navigator.clipboard
      .writeText(referralLink)
      .then(() => {
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2000);
      })
      .catch(() => setCopyStatus("idle"));
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/conta/${clientId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as {
          timeZone: string;
          logoUrl: string | null;
          contactEmail: string | null;
          planName: string | null;
          paymentStatus: string | null;
          contractDuration: string;
          payments: Payment[];
          referralLeads: ReferralLead[];
        };
      })
      .then((data) => {
        if (!cancelled) {
          setTimeZone(data.timeZone);
          setContactEmail(data.contactEmail ?? "");
          setLogoUrl(data.logoUrl);
          setPlanName(data.planName);
          setPaymentStatus(data.paymentStatus);
          setContractDuration(data.contractDuration);
          setPayments(data.payments);
          setReferralLeads(data.referralLeads);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function handleSaveTimeZone() {
    setSaveStatus("saving");
    fetch(`/api/conta/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setSaveStatus("saved");
      })
      .catch(() => setSaveStatus("error"));
  }

  function handleSaveEmail() {
    setEmailSaveStatus("saving");
    fetch(`/api/conta/${clientId}/email`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: contactEmail }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setEmailSaveStatus("saved");
      })
      .catch(() => setEmailSaveStatus("error"));
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("saving");
    const formData = new FormData();
    formData.append("logo", file);
    fetch(`/api/conta/${clientId}/logo`, {
      method: "POST",
      body: formData,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        setLogoUrl(data.logoUrl);
        setUploadStatus("saved");
      })
      .catch(() => setUploadStatus("error"));
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] gap-8 px-6 pt-6 pb-10 sm:px-10">
      <ContaSidebar clientName={clientName} email={contactEmail} logoUrl={logoUrl} />

      <div className="min-w-0 flex-1">
        {status === "loading" && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {status === "error" && (
          <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar as configurações agora.
          </p>
        )}
        {status === "ready" && (
          <div className="flex flex-col gap-6">
            <section id="perfil">
              <ContaPerfilSection
                clientName={clientName}
                contactEmail={contactEmail}
                onEmailChange={(value) => {
                  setContactEmail(value);
                  setEmailSaveStatus("idle");
                }}
                emailSaveStatus={emailSaveStatus}
                onSaveEmail={handleSaveEmail}
                logoUrl={logoUrl}
                uploadStatus={uploadStatus}
                fileInputRef={fileInputRef}
                onLogoChange={handleLogoChange}
              />
            </section>
            <section id="fuso">
              <ContaFusoSection
                timeZone={timeZone}
                onTimeZoneChange={(value) => {
                  setTimeZone(value);
                  setSaveStatus("idle");
                }}
                saveStatus={saveStatus}
                onSave={handleSaveTimeZone}
              />
            </section>
            <section id="faturamento">
              <ContaFaturamentoSection
                planName={planName}
                paymentStatus={paymentStatus}
                contractDuration={contractDuration}
                payments={payments}
              />
            </section>
            <section id="indicacoes">
              <ContaIndicacoesSection
                referralLink={referralLink}
                copyStatus={copyStatus}
                onCopy={handleCopyLink}
                referralLeads={referralLeads}
              />
            </section>
            <section id="seguranca">
              <ContaSegurancaSection />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
