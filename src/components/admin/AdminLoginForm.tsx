"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="animate-spin">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M12.5 7A5.5 5.5 0 0 0 7 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function InputWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-foreground/[0.04] transition-colors focus-within:bg-foreground/[0.07]">
      {children}
    </div>
  );
}

export function AdminLoginForm() {
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
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 429) {
        setError("Muitas tentativas... Espera alguns minutos e tenta de novo.");
        return;
      }
      if (!res.ok) {
        setError("Email ou senha inválidos.");
        return;
      }
      router.push("/admin/clientes");
    } catch {
      setError("Email ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-login-email" className="text-sm font-medium text-muted-foreground">
          Email
        </label>
        <InputWrapper>
          <input
            id="admin-login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent p-4 text-sm text-foreground outline-none"
          />
        </InputWrapper>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-login-password" className="text-sm font-medium text-muted-foreground">
          Senha
        </label>
        <InputWrapper>
          <input
            id="admin-login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent p-4 text-sm text-foreground outline-none"
          />
        </InputWrapper>
      </div>

      {error && (
        <p role="alert" className="text-xs text-brand-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading && <SpinnerIcon />}
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
