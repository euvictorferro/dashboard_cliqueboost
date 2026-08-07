"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/layout/ErrorScreen";

// Boundary de erro de página (Next App Router). Pega qualquer exceção não tratada dentro das
// páginas e mostra uma tela amigável em vez de quebrar branco. `reset` re-renderiza a rota.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <ErrorScreen
      emoji="⚠️"
      title="Algo deu errado"
      message="Tivemos um problema ao carregar esta página. Tente de novo — se continuar, avise a equipe da Clique Boost."
      action={
        <button
          type="button"
          onClick={reset}
          className="rounded-2xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Tentar de novo
        </button>
      }
    />
  );
}
