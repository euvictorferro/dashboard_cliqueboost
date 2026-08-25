"use client";

import { useEffect, useState } from "react";
import type { ContentList } from "@/lib/trello";
import { ContentBoard } from "@/components/conteudos/ContentBoard";

type ErrorKind = "no_board" | "fetch_failed";

export function ContentPageClient({ clientId }: { clientId: string;  }) {
  const [lists, setLists] = useState<ContentList[] | null>(null);
  const [error, setError] = useState<ErrorKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLists(null);
    setError(null);
    fetch(`/api/content/${clientId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error === "no_board_configured" ? "no_board" : "fetch_failed");
        }
        return data as { lists: ContentList[] };
      })
      .then((data) => {
        if (!cancelled) setLists(data.lists);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message === "no_board" ? "no_board" : "fetch_failed");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const errorMessage =
    error === "no_board"
      ? "Nenhum board configurado pra esse cliente."
      : "Não foi possível carregar os conteúdos agora.";

  return (
    <div className="w-full pt-6 pb-10">
      {error && (
        <p className="mx-6 rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)] sm:mx-10">
          {errorMessage}
        </p>
      )}
      {!error && !lists && <p className="mx-6 text-sm text-muted-foreground sm:mx-10">Carregando...</p>}
      {!error && lists && (
        <div data-tour="conteudos-board">
          <ContentBoard lists={lists} clientId={clientId} />
        </div>
      )}
    </div>
  );
}
