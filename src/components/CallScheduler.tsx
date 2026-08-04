// src/components/CallScheduler.tsx
"use client";

import { useEffect, useState } from "react";
import { useTimeZone } from "./TimeZoneContext";
import { formatTZTime } from "@/lib/clientTime";
import { formatCallDateHeader } from "@/lib/formatCallDate";

type CallInfo = { id: string; scheduledAt: number };
type Status = "loading" | "error" | "ready";

export function CallScheduler({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const timeZone = useTimeZone();
  const [status, setStatus] = useState<Status>("loading");
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);
  const [freeSlots, setFreeSlots] = useState<number[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  function load() {
    setStatus("loading");
    fetch(`/api/atas/${clientId}/call?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { activeCall: CallInfo | null; freeSlots: number[] };
      })
      .then((data) => {
        setActiveCall(data.activeCall);
        setFreeSlots(data.freeSlots);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  useEffect(load, [clientId, accessKey]);

  function schedule(slot: number) {
    setScheduling(true);
    fetch(`/api/atas/${clientId}/call?key=${encodeURIComponent(accessKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: slot }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setShowPicker(false);
        load();
      })
      .catch(() => setStatus("error"))
      .finally(() => setScheduling(false));
  }

  if (status === "loading") return <p className="text-sm text-muted-foreground">Carregando disponibilidade...</p>;
  if (status === "error") {
    return (
      <p className="rounded-[var(--radius-card)] bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
        Não foi possível carregar o agendamento agora.
      </p>
    );
  }

  return (
    <div className="mb-6 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
      {activeCall && !showPicker && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-card-foreground">
            Call agendada para {formatCallDateHeader(activeCall.scheduledAt, timeZone, { withYear: true })} às{" "}
            {formatTZTime(activeCall.scheduledAt, timeZone)}
          </p>
          <button
            onClick={() => setShowPicker(true)}
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90"
          >
            Remarcar Call
          </button>
        </div>
      )}
      {!activeCall && !showPicker && (
        <button
          onClick={() => setShowPicker(true)}
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90"
        >
          Agendar Call
        </button>
      )}
      {showPicker && (
        <div>
          <p className="mb-3 text-sm font-semibold text-card-foreground">Escolha um horário:</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {freeSlots.slice(0, 20).map((slot) => (
              <button
                key={slot}
                disabled={scheduling}
                onClick={() => schedule(slot)}
                className="rounded-md border border-border px-3 py-2 text-xs text-card-foreground hover:bg-brand-primary/10 disabled:opacity-50"
              >
                {formatCallDateHeader(slot, timeZone, { withYear: false })} {formatTZTime(slot, timeZone)}
              </button>
            ))}
          </div>
          {freeSlots.length === 0 && <p className="text-xs text-muted-foreground">Nenhum horário livre nos próximos dias.</p>}
        </div>
      )}
    </div>
  );
}
