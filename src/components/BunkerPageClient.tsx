"use client";

import { useEffect, useState } from "react";
import type { ContentList } from "@/lib/trello";
import type { Competitor } from "@/lib/competitors";
import { IdeasList } from "./IdeasList";
import { CompetitorsSection } from "./CompetitorsSection";

type ErrorKind = "no_board" | "fetch_failed";

function findIdeasList(lists: ContentList[]): ContentList | null {
  return lists.find((l) => /ideias|backlog/i.test(l.name)) ?? null;
}

export function BunkerPageClient({ clientId, accessKey }: { clientId: string; accessKey: string }) {
  const [lists, setLists] = useState<ContentList[] | null>(null);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[] | null>(null);
  const [competitorsError, setCompetitorsError] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setCompetitors(null);
    setCompetitorsError(false);
    fetch(`/api/content/${clientId}/competitors?key=${encodeURIComponent(accessKey)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { competitors: Competitor[] };
      })
      .then((data) => {
        if (!cancelled) setCompetitors(data.competitors ?? []);
      })
      .catch(() => {
        if (!cancelled) setCompetitorsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey]);

  const errorMessage =
    error === "no_board" ? "Nenhum board configurado pra esse cliente." : "Não foi possível carregar as ideias agora.";

  const ideasList = lists ? findIdeasList(lists) : null;

  return (
    <div className="w-full pt-6 pb-10 px-6 sm:px-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="min-h-0">
          <h2 className="mb-4 text-lg font-bold text-card-foreground">Ideias</h2>
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-2">
            {error && (
              <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
                {errorMessage}
              </p>
            )}
            {!error && !lists && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!error && lists && <IdeasList cards={ideasList?.cards ?? []} clientId={clientId} accessKey={accessKey} />}
          </div>
        </div>

        <div className="min-h-0">
          <h2 className="mb-4 text-lg font-bold text-card-foreground">Concorrentes e referências</h2>
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-2">
            {competitorsError && (
              <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
                Não foi possível carregar os concorrentes agora.
              </p>
            )}
            {!competitorsError && competitors === null && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!competitorsError && competitors && (
              <CompetitorsSection clientId={clientId} accessKey={accessKey} initialCompetitors={competitors} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
