import { Logo } from "@/components/layout/Logo";

// Tela de erro compartilhada (404, erro de página, erro global). Sem hooks pra poder ser usada
// tanto em Server Components (not-found) quanto dentro de boundaries client (error).
export function ErrorScreen({
  emoji,
  title,
  message,
  action,
}: {
  emoji: string;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <Logo />
      <span className="mt-4 text-3xl">{emoji}</span>
      <p className="text-xl font-bold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
