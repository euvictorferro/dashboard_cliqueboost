// src/components/ReferralLeadForm.tsx
"use client";

import { useState } from "react";

type Status = "idle" | "saving" | "saved" | "error";

export function ReferralLeadForm({ referrerClientId }: { referrerClientId: string }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    fetch("/api/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrerClientId, name, contact }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("saved");
      })
      .catch(() => setStatus("error"));
  }

  if (status === "saved") {
    return (
      <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-card-foreground shadow-[var(--shadow-soft)]">
        Recebemos seu contato! Em breve alguém da Clique Boost fala com você.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]">
      <label className="text-xs font-semibold text-card-foreground">Nome</label>
      <input
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <label className="text-xs font-semibold text-card-foreground">WhatsApp</label>
      <input
        type="text"
        required
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="(00) 00000-0000"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <button
        type="submit"
        disabled={status === "saving"}
        className="mt-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
      >
        {status === "saving" ? "Enviando..." : "Quero saber mais"}
      </button>
      {status === "error" && <p className="text-xs text-red-500">Não foi possível enviar, tenta de novo.</p>}
    </form>
  );
}
