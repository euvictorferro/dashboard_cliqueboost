"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UpdateCredentialsForm({ clientId }: { clientId: string }) {
  const router = useRouter();
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
      router.push(`/${clientId}`);
      router.refresh();
    } catch {
      setError("Não foi possível atualizar agora, tenta de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-email" className="text-sm font-medium text-muted-foreground">
          Seu email
        </label>
        <input
          id="new-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl bg-foreground/[0.04] p-4 text-sm text-foreground outline-none focus:bg-foreground/[0.07]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-password" className="text-sm font-medium text-muted-foreground">
          Nova senha
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-2xl bg-foreground/[0.04] p-4 text-sm text-foreground outline-none focus:bg-foreground/[0.07]"
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
        className="rounded-2xl bg-foreground py-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Salvando..." : "Salvar e continuar"}
      </button>
    </form>
  );
}
