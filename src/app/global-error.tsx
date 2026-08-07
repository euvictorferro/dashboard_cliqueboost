"use client";

import { useEffect } from "react";
import { Globe } from "@/components/layout/Globe";

// Último recurso: só dispara se o próprio layout raiz quebrar. Substitui todo o documento, então
// é autossuficiente — sem Tailwind (o CSS do app não carrega aqui). Estilo inline + um <style>
// mínimo pro globo (que precisa de tamanho explícito no canvas) e pra animação de flutuação.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          fontFamily: "system-ui, sans-serif",
          background: "#0f1115",
          color: "#f2f4f7",
          textAlign: "center",
          padding: "16px",
        }}
      >
        <style>{`
          .ge-globe { width: 128px; height: 128px; animation: ge-float 5s ease-in-out infinite; }
          .ge-globe canvas { width: 128px; height: 128px; }
          @keyframes ge-float { 0%,100% { transform: translateY(-4px);} 50% { transform: translateY(4px);} }
          @media (prefers-reduced-motion: reduce) { .ge-globe { animation: none; } }
        `}</style>

        <div className="ge-globe" style={{ marginBottom: "12px" }}>
          <Globe />
        </div>

        <p style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Algo deu errado</p>
        <p style={{ fontSize: "14px", color: "#98a2b3", maxWidth: "22rem", margin: 0 }}>
          Tivemos um problema inesperado. Tente recarregar — se continuar, avise a equipe da Clique Boost.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "12px",
            borderRadius: "16px",
            border: "none",
            background: "#f2f4f7",
            color: "#0f1115",
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
