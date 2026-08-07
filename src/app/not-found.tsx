import Link from "next/link";
import { Globe } from "@/components/layout/Globe";
import { Logo } from "@/components/layout/Logo";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <Link href="/login" className="absolute left-6 top-6">
        <Logo width={120} height={32} />
      </Link>

      <div className="login-animate mb-10 flex items-center justify-center gap-4 md:gap-6">
        <span className="select-none text-7xl font-bold text-foreground/80 md:text-8xl">4</span>

        <div className="not-found-float relative h-24 w-24 md:h-32 md:w-32">
          <Globe />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.08)_0%,transparent_70%)]" />
        </div>

        <span className="select-none text-7xl font-bold text-foreground/80 md:text-8xl">4</span>
      </div>

      <h1 className="login-animate login-animate-delay-1 mb-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
        Ops! Perdido no espaço
      </h1>
      <p className="login-animate login-animate-delay-2 mx-auto mb-10 max-w-md text-base text-muted-foreground md:text-lg">
        Não encontramos a página que você procura. Ela pode ter sido movida ou removida.
      </p>

      <Link
        href="/login"
        className="login-animate login-animate-delay-3 inline-flex items-center gap-2 rounded-2xl bg-foreground px-6 py-3 text-sm font-medium text-background transition-transform duration-300 hover:scale-105"
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Voltar ao início
      </Link>
    </div>
  );
}
