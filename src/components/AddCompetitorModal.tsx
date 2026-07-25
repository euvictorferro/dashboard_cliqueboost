"use client";

import { useState } from "react";
import type { Competitor } from "@/lib/competitors";

const PLATFORMS: { value: Competitor["platform"]; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
];

export function AddCompetitorModal({
  clientId,
  accessKey,
  onAdded,
  onClose,
}: {
  clientId: string;
  accessKey: string;
  onAdded: (competitor: Competitor) => void;
  onClose: () => void;
}) {
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<Competitor["platform"]>("instagram");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    if (!handle.trim() || saving) return;
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(`/api/content/${clientId}/competitors?key=${encodeURIComponent(accessKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.trim(), platform }),
      });
      if (!res.ok) throw new Error();
      const data: { competitor: Competitor } = await res.json();
      onAdded(data.competitor);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-card-foreground">Adicionar concorrente</h2>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">@ do perfil</label>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@perfil"
            autoFocus
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Plataforma</label>
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPlatform(p.value)}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                  platform === p.value
                    ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mb-3 text-xs text-red-500">Não foi possível adicionar. Tente de novo.</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !handle.trim()}
            className="rounded-md bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
