"use client";

// ponytail: stub — o Victor quer um relatório em PDF com layout próprio (não print de tela).
// Precisa do design do documento antes de implementar a geração real.
export function ExportPdfButton() {
  return (
    <button
      onClick={() => alert("Relatório em PDF ainda em desenvolvimento — layout do documento em definição.")}
      className="flex items-center gap-2 rounded-[var(--radius-card)] border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted"
    >
      Baixar relatório (PDF)
    </button>
  );
}
