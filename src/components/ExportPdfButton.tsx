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

// ponytail: stub — relatório em PDF com análise real será feito depois (layout + IA em definição).
// Botão fica desabilitado com aviso no hover em vez de disparar uma ação que não faz nada de fato.
export function ExportPdfButton() {
  return (
    <span className="group relative inline-flex">
      <button
        disabled
        className="flex cursor-not-allowed items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-[var(--shadow-soft)] opacity-70"
      >
        <DownloadIcon />
        Baixar relatório
      </button>
      <span className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-56 rounded-md bg-foreground px-3 py-2 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        Estamos atualizando essa funcionalidade. Em breve ela volta a funcionar.
      </span>
    </span>
  );
}
