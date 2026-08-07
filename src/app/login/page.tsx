// src/app/login/page.tsx
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";
import { LoginHero } from "@/components/LoginHero";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_28rem]">
      <LoginHero />

      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-6 text-center lg:hidden">
            <Logo />
            <p className="text-sm text-muted-foreground">Tudo o que sua marca precisa, em um só lugar.</p>
          </div>

          <div className="login-animate mb-6">
            <h2 className="text-xl font-semibold text-foreground">Entrar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Entra com o email e senha que a Clique Boost te passou.</p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
