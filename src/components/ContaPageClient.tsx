"use client";

import { useEffect, useRef, useState } from "react";
import { US_TIMEZONES } from "@/lib/clientTime";

type Status = "loading" | "error" | "ready";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ContaPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [timeZone, setTimeZone] = useState<string>("America/New_York");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const [brandColor, setBrandColor] = useState<string>("#7C3AED");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandSaveStatus, setBrandSaveStatus] = useState<SaveStatus>("idle");
  const [uploadStatus, setUploadStatus] = useState<SaveStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { timeZone: string; brandColor: string | null; logoUrl: string | null };
      })
      .then((data) => {
        if (!cancelled) {
          setTimeZone(data.timeZone);
          if (data.brandColor) setBrandColor(data.brandColor);
          setLogoUrl(data.logoUrl);
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

  function handleSaveBrandColor() {
    setBrandSaveStatus("saving");
    fetch(`/api/conta/${clientId}/brand?key=${encodeURIComponent(accessKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandColor }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setBrandSaveStatus("saved");
      })
      .catch(() => setBrandSaveStatus("error"));
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
            <h2 className="mb-1 text-sm font-bold text-card-foreground">Marca</h2>
            <p className="mb-4 text-xs text-muted-foreground">Cor principal e logo exibidos no dashboard.</p>

            <label className="mb-1 block text-xs font-semibold text-card-foreground">Cor principal</label>
            <div className="mb-4 flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => {
                  setBrandColor(e.target.value);
                  setBrandSaveStatus("idle");
                }}
                className="h-10 w-14 cursor-pointer rounded-md border border-border bg-background"
              />
              <span className="text-sm text-muted-foreground">{brandColor}</span>
            </div>
            <button
              type="button"
              onClick={handleSaveBrandColor}
              disabled={brandSaveStatus === "saving"}
              className="mb-6 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {brandSaveStatus === "saving" ? "Salvando..." : "Salvar cor"}
            </button>
            {brandSaveStatus === "saved" && <p className="-mt-4 mb-6 text-xs text-green-600">Salvo com sucesso.</p>}
            {brandSaveStatus === "error" && <p className="-mt-4 mb-6 text-xs text-red-500">Não foi possível salvar.</p>}

            <label className="mb-1 block text-xs font-semibold text-card-foreground">Logo</label>
            <div className="mb-3 flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo do cliente"
                  className="h-14 w-14 rounded-md border border-border bg-background object-contain"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  Sem logo
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus === "saving"}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {uploadStatus === "saving" ? "Enviando..." : "Enviar logo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>
            {uploadStatus === "saved" && <p className="text-xs text-green-600">Logo atualizado.</p>}
            {uploadStatus === "error" && <p className="text-xs text-red-500">Não foi possível enviar o logo.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
