"use client";

import { useEffect, useState } from "react";
import type { Competitor, CompetitorProfile } from "@/lib/competitors";

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}mil`;
  return String(n);
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CompetitorProfileModal({
  competitor,
  clientId,
  accessKey,
  onClose,
}: {
  competitor: Competitor;
  clientId: string;
  accessKey: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<CompetitorProfile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/content/${clientId}/competitors/${competitor.id}/profile?key=${encodeURIComponent(accessKey)}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: CompetitorProfile) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey, competitor.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-soft)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-card-foreground">{competitor.handle}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        {failed && <p className="text-sm text-muted-foreground">Não foi possível carregar o perfil.</p>}
        {!failed && profile === null && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!failed && profile && (
          <div className="space-y-6">
            <div className="flex gap-6">
              <div>
                <p className="text-lg font-bold text-card-foreground">{formatCount(profile.followers)}</p>
                <p className="text-xs text-muted-foreground">Seguidores</p>
              </div>
              <div>
                <p className="text-lg font-bold text-card-foreground">{formatCount(profile.following)}</p>
                <p className="text-xs text-muted-foreground">Seguindo</p>
              </div>
              <div>
                <p className="text-lg font-bold text-card-foreground">{formatCount(profile.postsCount)}</p>
                <p className="text-xs text-muted-foreground">Posts</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-card-foreground">Posts mais engajados</p>
              <div className="space-y-2">
                {profile.topPosts.map((post) => (
                  <div key={post.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                      {competitor.handle.replace(/^@/, "").slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-card-foreground">{post.caption}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {post.likes.toLocaleString("pt-BR")} curtidas · {post.reach.toLocaleString("pt-BR")} alcance
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled
                      title="Em breve"
                      className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground opacity-50"
                    >
                      Recriar o post
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
