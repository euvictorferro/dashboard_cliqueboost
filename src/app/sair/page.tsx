import { Logo } from "@/components/Logo";

export default function SairPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Logo />
      <h1 className="text-xl font-semibold text-foreground">Você saiu</h1>
      <p className="text-sm text-muted-foreground">Peça um novo link de acesso à Clique Boost pra entrar de novo.</p>
    </div>
  );
}
