"use client";

import { useEffect, useRef, useState } from "react";
import type { Competitor, CompetitorPost } from "@/lib/competitors";
import { AddCompetitorModal } from "@/components/dashboard/AddCompetitorModal";
import { CompetitorProfileModal } from "@/components/dashboard/CompetitorProfileModal";

const PLATFORM_LABELS: Record<Competitor["platform"], string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="3.5" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="12.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onOutside]);
  return ref;
}

function CompetitorCard({
  competitor,
  clientId,
  onDeleted,
}: {
  competitor: Competitor;
  clientId: string;
  onDeleted: (id: string) => void;
}) {
  const [feed, setFeed] = useState<CompetitorPost[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useClickOutside(() => setMenuOpen(false));

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/content/${clientId}/competitors/${competitor.id}/feed`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: { feed: CompetitorPost[] }) => {
        if (!cancelled) setFeed(data.feed);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, competitor.id]);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/content/${clientId}/competitors/${competitor.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      onDeleted(competitor.id);
    } catch (err) {
      console.error("falha ao excluir concorrente", err);
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-card-foreground">{competitor.handle}</p>
          <p className="text-xs text-muted-foreground">{PLATFORM_LABELS[competitor.platform]}</p>
        </div>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Mais opções"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <MoreIcon />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileOpen(true);
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                Ver perfil
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="block w-full rounded px-2 py-1.5 text-left text-xs text-red-500 hover:bg-muted disabled:opacity-50"
              >
                {deleting ? "Excluindo..." : "Excluir perfil"}
              </button>
            </div>
          )}
        </div>
      </div>

      {failed && <p className="text-xs text-muted-foreground">Não foi possível carregar os posts.</p>}
      {!failed && feed === null && <p className="text-xs text-muted-foreground">Carregando...</p>}
      {!failed && feed !== null && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="w-10 shrink-0">Post</span>
            <span className="flex-1">Legenda</span>
            <span className="w-16 shrink-0 text-right">Curtidas</span>
            <span className="w-16 shrink-0 text-right">Alcance</span>
          </div>
          {feed.map((post) => (
            <a
              key={post.id}
              href={post.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-muted"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                {competitor.handle.replace(/^@/, "").slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-card-foreground">{post.caption}</span>
              <span className="w-16 shrink-0 text-right text-muted-foreground">{post.likes.toLocaleString("pt-BR")}</span>
              <span className="w-16 shrink-0 text-right text-muted-foreground">{post.reach.toLocaleString("pt-BR")}</span>
            </a>
          ))}
        </div>
      )}

      {profileOpen && (
        <CompetitorProfileModal
          competitor={competitor}
          clientId={clientId}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}

export function CompetitorsSection({
  clientId,
  initialCompetitors,
}: {
  clientId: string;
  initialCompetitors: Competitor[];
}) {
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [adding, setAdding] = useState(false);

  function handleAdded(competitor: Competitor) {
    setCompetitors((prev) => [...prev, competitor]);
    setAdding(false);
  }

  function handleDeleted(id: string) {
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Feed de exemplo — mostra dados reais assim que conectarmos a análise de concorrentes.
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white"
        >
          + Adicionar
        </button>
      </div>

      {competitors.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-card p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-muted-foreground">Nenhum concorrente cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {competitors.map((competitor) => (
            <CompetitorCard
              key={competitor.id}
              competitor={competitor}
              clientId={clientId}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {adding && (
        <AddCompetitorModal clientId={clientId} onAdded={handleAdded} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}
