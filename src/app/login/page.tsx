// src/app/login/page.tsx
import { Logo } from "@/components/layout/Logo";
import { LoginForm } from "@/components/login/LoginForm";
import { LoginHero } from "@/components/login/LoginHero";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="login-animate mb-8">
            <Logo />
          </div>

          <div className="login-animate mb-6">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
              Entrar
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">Entra com o email e senha que a Clique Boost te passou.</p>
          </div>

          <LoginForm />
        </div>
      </div>

      <LoginHero />
    </div>
  );
}
