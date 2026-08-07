"use client";

import { useEffect } from "react";
import { Globe } from "@/components/layout/Globe";
import { Logo } from "@/components/layout/Logo";

// Boundary de erro de página (Next App Router). Pega qualquer exceção não tratada dentro das
// páginas e mostra uma tela amigável em vez de quebrar branco. `reset` re-renderiza a rota.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="absolute left-6 top-6">
        <Logo width={120} height={32} />
      </div>

      <div className="not-found-float login-animate relative mb-8 h-28 w-28 md:h-36 md:w-36">
        <Globe />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.08)_0%,transparent_70%)]" />
      </div>

      <h1 className="login-animate login-animate-delay-1 mb-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
        Algo deu errado
      </h1>
      <p className="login-animate login-animate-delay-2 mx-auto mb-10 max-w-md text-base text-muted-foreground md:text-lg">
        Tivemos um problema ao carregar esta página. Tente de novo — se continuar, avise a equipe da Clique Boost.
      </p>

      <button
        type="button"
        onClick={reset}
        className="login-animate login-animate-delay-3 inline-flex items-center gap-2 rounded-2xl bg-foreground px-6 py-3 text-sm font-medium text-background transition-transform duration-300 hover:scale-105"
      >
        Tentar de novo
      </button>
    </div>
  );
}
