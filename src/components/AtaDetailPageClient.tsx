// src/components/AtaDetailPageClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { CallNote } from "@/lib/callNotes";
import { formatCallDateHeader } from "@/lib/formatCallDate";
import { formatNYTime } from "@/lib/nyTime";

type Status = "loading" | "error" | "not_found" | "success";

export function AtaDetailPageClient({
  clientId,
  accessKey,
  noteId,
}: {
  clientId: string;
  accessKey: string;
  noteId: string;
}) {
  const [note, setNote] = useState<CallNote | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setNote(null);
    fetch(`/api/atas/${clientId}/${noteId}?key=${encodeURIComponent(accessKey)}`)
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
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setStatus(err.message === "not_found" ? "not_found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, accessKey, noteId]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-10">
      <Link
        href={`/${clientId}/atas?key=${encodeURIComponent(accessKey)}`}
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
          <h1 className="text-2xl font-bold text-foreground">{note.title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            {formatCallDateHeader(note.callAt, { withYear: true })} · {formatNYTime(note.callAt)}
          </p>
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
