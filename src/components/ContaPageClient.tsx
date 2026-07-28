"use client";

import { useEffect, useState } from "react";
import { US_TIMEZONES } from "@/lib/clientTime";

type Status = "loading" | "error" | "ready";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ContaPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [timeZone, setTimeZone] = useState<string>("America/New_York");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/conta/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { timeZone: string };
      })
      .then((data) => {
        if (!cancelled) {
          setTimeZone(data.timeZone);
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

  function handleSave() {
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
        <div className="max-w-md rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
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
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Salvando..." : "Salvar"}
          </button>
          {saveStatus === "saved" && <p className="mt-2 text-xs text-green-600">Salvo com sucesso.</p>}
          {saveStatus === "error" && <p className="mt-2 text-xs text-red-500">Não foi possível salvar.</p>}
        </div>
      )}
    </div>
  );
}
