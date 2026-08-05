"use client";

import { useEffect, useState } from "react";
import type { ContentList } from "@/lib/trello";
import { ContentBoard } from "./ContentBoard";

type ErrorKind = "no_board" | "fetch_failed";

export function ContentPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [lists, setLists] = useState<ContentList[] | null>(null);
  const [error, setError] = useState<ErrorKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLists(null);
    setError(null);
    fetch(`/api/content/${clientId}?key=${encodeURIComponent(accessKey)}`)
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
  }, [clientId, accessKey]);

  const errorMessage =
    error === "no_board"
      ? "Nenhum board configurado pra esse cliente."
      : "Não foi possível carregar os conteúdos agora.";

  return (
    <div className="w-full pt-6 pb-10 pl-6 sm:pl-10">
      {error && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          {errorMessage}
        </p>
      )}
      {!error && !lists && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!error && lists && <ContentBoard lists={lists} clientId={clientId} accessKey={accessKey} />}
    </div>
  );
}
