import Link from "next/link";
import { CLIENTS } from "@/lib/clients";

// Índice interno — cada cliente acessa direto pelo próprio link (/[client]), não por aqui.
export default function Home() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-3 px-4 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-accent">Clique Boost — interno</p>
      <h1 className="mb-2 text-xl font-semibold text-foreground">Dashboards de clientes</h1>
      {CLIENTS.map((c) => (
        <Link
          key={c.id}
          href={`/${c.id}`}
          className="rounded-[var(--radius-card)] border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground hover:border-brand-primary"
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
