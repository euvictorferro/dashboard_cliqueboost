// src/components/LoginForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function EyeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function EyeOffIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.5 1.5l13 13M6.6 6.7a2 2 0 0 0 2.7 2.7M3.3 3.9C1.9 4.9 1 8 1 8s2.5 5 7 5c1.2 0 2.2-.3 3.1-.8M9.9 3.3c-.6-.2-1.2-.3-1.9-.3-4.5 0-7 5-7 5"
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
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M12.5 7A5.5 5.5 0 0 0 7 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Email ou senha inválidos.");
        return;
      }
      const { clientId } = await res.json();
      router.push(`/${clientId}`);
    } catch {
      setError("Email ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4" noValidate>
      <div className="login-animate login-animate-delay-1 flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <div className="rounded-2xl border border-border bg-foreground/[0.03] backdrop-blur-sm transition-colors focus-within:border-brand-primary/70 focus-within:bg-brand-primary/[0.06]">
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent px-4 py-3 text-sm text-foreground outline-none"
          />
        </div>
      </div>

      <div className="login-animate login-animate-delay-2 flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-sm font-medium text-foreground">
          Senha
        </label>
        <div className="relative rounded-2xl border border-border bg-foreground/[0.03] backdrop-blur-sm transition-colors focus-within:border-brand-primary/70 focus-within:bg-brand-primary/[0.06]">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent px-4 py-3 pr-11 text-sm text-foreground outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-brand-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="login-animate login-animate-delay-3 mt-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95 disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, hsl(var(--brand-primary)), hsl(var(--brand-accent)))" }}
      >
        {loading && <SpinnerIcon />}
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
