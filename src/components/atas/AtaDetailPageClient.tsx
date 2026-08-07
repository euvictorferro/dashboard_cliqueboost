// src/components/AtaDetailPageClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { CallNote } from "@/lib/callNotes";
import { formatCallDateHeader } from "@/lib/formatCallDate";
import { formatTZTime } from "@/lib/clientTime";
import { useTimeZone } from "./TimeZoneContext";

type Status = "loading" | "error" | "not_found" | "success";
type ExtractStatus = "idle" | "extracting" | "done" | "already_extracted" | "error";

export function AtaDetailPageClient({
  clientId,
  noteId,
}: {
  clientId: string;
  noteId: string;
}) {
  const timeZone = useTimeZone();
  const [note, setNote] = useState<CallNote | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [extractStatus, setExtractStatus] = useState<ExtractStatus>("idle");
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setNote(null);
    fetch(`/api/atas/${clientId}/${noteId}`)
      .then(async (res) => {
        if (res.status === 404) throw new Error("not_found");
        const data = await res.json();
        if (!res.ok) throw new Error("fetch_failed");
        return data as { note: CallNote };
      })
      .then((data) => {
        if (!cancelled) {
          setNote(data.note);
          setStatus("success");
          if (data.note.tasksExtractedAt !== null) setExtractStatus("already_extracted");
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setStatus(err.message === "not_found" ? "not_found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, noteId]);

  function extractTasks() {
    setExtractStatus("extracting");
    fetch(`/api/atas/${clientId}/${noteId}/extract-tasks`, { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error();
        return data as { created: number };
      })
      .then((data) => {
        setCreatedCount(data.created);
        setExtractStatus("done");
      })
      .catch(() => setExtractStatus("error"));
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-10">
      <Link
        href={`/${clientId}/atas`}
        className="mb-6 inline-block text-sm font-medium text-muted-foreground hover:text-card-foreground"
      >
        ← Voltar
      </Link>

      {status === "loading" && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {status === "error" && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Não foi possível carregar essa ata agora.
        </p>
      )}
      {status === "not_found" && (
        <p className="rounded-[var(--radius-card)] bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          Ata não encontrada.
        </p>
      )}
      {status === "success" && note && (
        <div className="rounded-[var(--radius-card)] bg-card p-8 shadow-[var(--shadow-soft)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{note.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCallDateHeader(note.callAt, timeZone, { withYear: true })} · {formatTZTime(note.callAt, timeZone)}
              </p>
            </div>
            <button
              onClick={extractTasks}
              disabled={extractStatus === "extracting"}
              className="shrink-0 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {extractStatus === "extracting"
                ? "Extraindo..."
                : extractStatus === "done"
                  ? `Tasks criadas (${createdCount})`
                  : extractStatus === "already_extracted"
                    ? "Tasks já extraídas"
                    : "Extrair tasks"}
            </button>
          </div>
          {extractStatus === "error" && (
            <p className="mb-4 text-xs text-red-500">Não foi possível extrair as tasks, tenta de novo.</p>
          )}
          <ReactMarkdown
            components={{
              h1: (props) => <h2 className="mb-3 mt-6 text-lg font-bold text-card-foreground first:mt-0" {...props} />,
              h2: (props) => <h2 className="mb-3 mt-6 text-lg font-bold text-card-foreground first:mt-0" {...props} />,
              h3: (props) => <h3 className="mb-2 mt-5 text-base font-bold text-card-foreground first:mt-0" {...props} />,
              p: (props) => <p className="mb-3 text-sm text-card-foreground" {...props} />,
              ul: (props) => <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-card-foreground" {...props} />,
              ol: (props) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-card-foreground" {...props} />,
              li: (props) => <li {...props} />,
              strong: (props) => <strong className="font-bold" {...props} />,
            }}
          >
            {note.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
