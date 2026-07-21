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

export function ExportPdfButton({
  clientId,
  range,
  accessKey,
}: {
  clientId: string;
  range: string;
  accessKey: string;
}) {
  return (
    <a
      href={`/api/report/${clientId}?range=${range}&key=${encodeURIComponent(accessKey)}`}
      className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-card-foreground shadow-[var(--shadow-soft)] hover:bg-muted"
    >
      <DownloadIcon />
      Baixar relatório
    </a>
  );
}
