"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

// ponytail: popup obrigatório — sem botão de fechar/backdrop-dismiss de propósito, a conta é
// temporária (email/senha provisórios) e precisa virar definitiva antes do cliente usar o resto.
export function UpdateCredentialsModal({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/update-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error === "email_invalido"
            ? "Email inválido."
            : data?.error === "senha_invalida"
              ? "A senha precisa ter pelo menos 8 caracteres."
              : "Não foi possível atualizar agora, tenta de novo."
        );
        return;
      }
      onDone();
    } catch {
      setError("Não foi possível atualizar agora, tenta de novo.");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h2 className="mb-1 text-sm font-bold text-card-foreground">Atualize sua conta</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Essa conta foi criada com um email temporário. Coloque seu email e uma senha só sua pra continuar.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="modal-new-email" className="text-xs text-muted-foreground">
              Seu email
            </label>
            <input
              id="modal-new-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="modal-new-password" className="text-xs text-muted-foreground">
              Nova senha
            </label>
            <input
              id="modal-new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-brand-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar e continuar"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
