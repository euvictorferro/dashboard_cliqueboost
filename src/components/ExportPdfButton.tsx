"use client";

import { useState } from "react";
import { InfoTooltip } from "./InfoTooltip";

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1v8m0 0L4 6m3 3l3-3M2 11v1.5A1.5 1.5 0 003.5 14h7a1.5 1.5 0 001.5-1.5V11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="animate-spin">
      <path
        d="M13 7A6 6 0 1 1 7 1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ExportPdfButton({
  clientId,
  range,
  accessKey,
  disabled,
}: {
  clientId: string;
  range: string;
  accessKey: string;
  disabled?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleClick() {
    if (downloading || disabled) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/report/${clientId}?range=${range}&key=${encodeURIComponent(accessKey)}`);
      if (!res.ok) throw new Error("falha ao gerar relatório");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-${clientId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // ponytail: se a geração falhar, só volta ao estado normal — sem toast/retry automático,
      // o cliente pode clicar de novo.
    } finally {
      setDownloading(false);
    }
  }

  if (disabled) {
    return (
      <span className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground opacity-60 shadow-[var(--shadow-soft)]">
        <DownloadIcon />
        Baixar relatório
        <InfoTooltip text="O relatório em PDF não funciona no modo de comparação de datas. Volte pra um período único pra baixar." />
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={downloading}
      className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-card-foreground shadow-[var(--shadow-soft)] hover:bg-muted disabled:cursor-wait"
    >
      {downloading ? <SpinnerIcon /> : <DownloadIcon />}
      {downloading ? "Baixando..." : "Baixar relatório"}
    </button>
  );
}
