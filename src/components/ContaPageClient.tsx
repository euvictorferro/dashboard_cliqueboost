"use client";

import { useEffect, useRef, useState } from "react";
import { US_TIMEZONES } from "@/lib/clientTime";

type Status = "loading" | "error" | "ready";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type Payment = { id: string; paidAt: string; amount: number | null };

export function ContaPageClient({
  clientId,
  clientName,
  accessKey,
}: {
  clientId: string;
  clientName: string;
  accessKey: string;
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

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`)
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
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey]);

  function handleSaveTimeZone() {
    setSaveStatus("saving");
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`, {
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
    fetch(`/api/conta/${clientId}/email?key=${encodeURIComponent(accessKey)}`, {
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
    fetch(`/api/conta/${clientId}/logo?key=${encodeURIComponent(accessKey)}`, {
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
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Conta</h1>

      {status === "loading" && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {status === "error" && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Não foi possível carregar as configurações agora.
        </p>
      )}
      {status === "ready" && (
        <div className="flex max-w-md flex-col gap-6">
          <div className="rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
            <h2 className="mb-1 text-sm font-bold text-card-foreground">Perfil</h2>
            <p className="mb-4 text-xs text-muted-foreground">Informações básicas da sua conta.</p>

            <label className="mb-1 block text-xs font-semibold text-card-foreground">Nome</label>
            <p className="mb-4 text-sm text-foreground">{clientName}</p>

            <label className="mb-1 block text-xs font-semibold text-card-foreground">E-mail cadastrado</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                setEmailSaveStatus("idle");
              }}
              placeholder="seu@email.com"
              className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={handleSaveEmail}
              disabled={emailSaveStatus === "saving"}
              className="mb-6 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {emailSaveStatus === "saving" ? "Salvando..." : "Salvar e-mail"}
            </button>
            {emailSaveStatus === "saved" && <p className="-mt-4 mb-6 text-xs text-green-600">Salvo com sucesso.</p>}
            {emailSaveStatus === "error" && <p className="-mt-4 mb-6 text-xs text-red-500">Não foi possível salvar.</p>}

            <label className="mb-1 block text-xs font-semibold text-card-foreground">Foto de perfil</label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Foto de perfil"
                  className="h-14 w-14 rounded-md border border-border bg-background object-contain"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  Sem foto
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus === "saving"}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {uploadStatus === "saving" ? "Enviando..." : "Enviar foto"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>
            {uploadStatus === "saved" && <p className="mt-2 text-xs text-green-600">Foto atualizada.</p>}
            {uploadStatus === "error" && <p className="mt-2 text-xs text-red-500">Não foi possível enviar a foto.</p>}
          </div>

          <div className="rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
            <h2 className="mb-1 text-sm font-bold text-card-foreground">Fuso horário</h2>
            <p className="mb-4 text-xs text-muted-foreground">Define o horário exibido no Calendário e nas Atas.</p>
            <select
              value={timeZone}
              onChange={(e) => {
                setTimeZone(e.target.value);
                setSaveStatus("idle");
              }}
              className="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {US_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveTimeZone}
              disabled={saveStatus === "saving"}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {saveStatus === "saving" ? "Salvando..." : "Salvar"}
            </button>
            {saveStatus === "saved" && <p className="mt-2 text-xs text-green-600">Salvo com sucesso.</p>}
            {saveStatus === "error" && <p className="mt-2 text-xs text-red-500">Não foi possível salvar.</p>}
          </div>

          <div className="rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
            <h2 className="mb-1 text-sm font-bold text-card-foreground">Faturamento</h2>
            <p className="mb-4 text-xs text-muted-foreground">Plano, pagamentos e tempo de contrato.</p>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-card-foreground">Plano</p>
                <p className="text-sm text-foreground">{planName ?? "Não configurado"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-card-foreground">Status de pagamento</p>
                <p className="text-sm text-foreground">{paymentStatus ?? "Não configurado"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-card-foreground">Tempo de contrato</p>
                <p className="text-sm text-foreground">{contractDuration}</p>
              </div>
            </div>

            <p className="mb-2 text-xs font-semibold text-card-foreground">Histórico de pagamentos</p>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between text-sm text-foreground">
                    <span>{p.paidAt}</span>
                    {p.amount != null && <span>R$ {p.amount.toFixed(2)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
