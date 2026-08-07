import Link from "next/link";
import { CLIENTS } from "@/lib/clients";
import { Logo } from "@/components/layout/Logo";

// Índice interno — cada cliente acessa direto pelo próprio link (/[client]), não por aqui.
export default function Home() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-3 px-4 py-16">
      <Logo />
      <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-brand-accent">Interno</p>
      <h1 className="mb-2 text-xl font-semibold text-foreground">Dashboards de clientes</h1>
      {CLIENTS.map((c) => (
        <Link
          key={c.id}
          href={`/${c.id}`}
          className="rounded-[var(--radius-card)] bg-card px-4 py-3 text-sm font-medium text-card-foreground shadow-[var(--shadow-soft)] hover:text-brand-primary"
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
