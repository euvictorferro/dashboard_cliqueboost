// src/app/login/page.tsx
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center gap-4 px-4 py-16">
      <Logo />
      <h1 className="text-xl font-semibold text-foreground">Entrar</h1>
      <LoginForm />
    </div>
  );
}
