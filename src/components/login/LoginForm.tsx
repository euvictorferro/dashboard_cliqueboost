// src/components/LoginForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isProductionEnv } from "@/lib/env";
import { WHATSAPP_LINK } from "@/lib/ads";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

function EyeIcon({ size = 18 }: { size?: number }) {
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

function EyeOffIcon({ size = 18 }: { size?: number }) {
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

function InputWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-foreground/[0.04] transition-colors focus-within:bg-foreground/[0.07]">
      {children}
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      if (res.status === 429) {
        setError("Muitas tentativas. Espera alguns minutos e tenta de novo.");
        return;
      }
      if (!res.ok) {
        setError("Email ou senha inválidos.");
        return;
      }
      const { clientId, mustResetCredentials } = await res.json();
      router.push(mustResetCredentials ? `/${clientId}/atualizar-conta` : `/${clientId}`);
    } catch {
      setError("Email ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5" noValidate>
      <div className="login-animate login-animate-delay-1 flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-sm font-medium text-muted-foreground">
          Email
        </label>
        <InputWrapper>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent p-4 text-sm text-foreground outline-none"
          />
        </InputWrapper>
      </div>

      <div className="login-animate login-animate-delay-2 flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-sm font-medium text-muted-foreground">
          Senha
        </label>
        <InputWrapper>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent p-4 pr-12 text-sm text-foreground outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </InputWrapper>
      </div>

      <div className="login-animate login-animate-delay-3 flex items-center justify-between text-sm">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="custom-checkbox"
          />
          <span className="text-foreground/90">Manter conectado</span>
        </label>
        <button
          type="button"
          onClick={() => setForgotPasswordOpen(true)}
          className="text-brand-primary transition-colors hover:underline"
        >
          Esqueci a senha
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-brand-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="login-animate login-animate-delay-4 flex items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading && <SpinnerIcon />}
        {loading ? "Entrando..." : "Entrar"}
      </button>

      {/* ponytail: Google login desativado (só decorativo, "Em breve") — some de vez em
          produção pra não sugerir uma feature que não existe pro cliente final. */}
      {!isProductionEnv() && (
        <>
          <div className="login-animate login-animate-delay-4 relative flex items-center justify-center">
            <span className="w-full border-t border-border" />
            <span className="absolute bg-background px-4 text-sm text-muted-foreground">ou continue com</span>
          </div>

          <button
            type="button"
            disabled
            title="Em breve"
            aria-disabled="true"
            className="login-animate login-animate-delay-4 flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl border border-border py-4 text-sm text-muted-foreground opacity-60"
          >
            <GoogleIcon />
            Continuar com Google
          </button>
        </>
      )}

      {forgotPasswordOpen && (
        <ForgotPasswordModal whatsappLink={WHATSAPP_LINK} onClose={() => setForgotPasswordOpen(false)} />
      )}
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z"
      />
    </svg>
  );
}
