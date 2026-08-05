// src/components/AtasPageClient.tsx
"use client";

import { useEffect, useState } from "react";
import type { CallNote } from "@/lib/callNotes";
import { AtasList } from "./AtasList";
import { CallScheduler } from "./CallScheduler";

export function AtasPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [notes, setNotes] = useState<CallNote[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNotes(null);
    setError(false);
    fetch(`/api/atas/${clientId}?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { notes: CallNote[] };
      })
      .then((data) => {
        if (!cancelled) setNotes(data.notes);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 pt-6 pb-10 sm:px-10">
      <CallScheduler clientId={clientId} accessKey={accessKey} />
      {error && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Não foi possível carregar as atas agora.
        </p>
      )}
      {!error && !notes && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!error && notes && <AtasList notes={notes} clientId={clientId} accessKey={accessKey} />}
    </div>
  );
}
