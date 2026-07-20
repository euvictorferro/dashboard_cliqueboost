import { Logo } from "./Logo";

export function AccessDenied() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <Logo />
      <span className="mt-4 text-2xl">🔒</span>
      <p className="text-xl font-bold text-foreground">Acesso não autorizado</p>
      <p className="text-sm text-muted-foreground">
        Esse link não é válido. Se você é cliente da Clique Boost, use o link enviado pela nossa equipe.
      </p>
    </div>
  );
}
