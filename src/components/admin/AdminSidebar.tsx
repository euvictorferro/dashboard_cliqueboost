"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/layout/Logo";

function ClientesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 15c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IndicacoesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2 9l4-4 3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 3h5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FaturamentoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7.5h14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type NavItemDef = { href: string; label: string; icon: () => React.JSX.Element };

const ITEMS: NavItemDef[] = [
  { href: "/admin/clientes", label: "Clientes", icon: ClientesIcon },
  { href: "/admin/indicacoes", label: "Indicações", icon: IndicacoesIcon },
  { href: "/admin/faturamento", label: "Faturamento", icon: FaturamentoIcon },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      router.push("/admin/login");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        <div className="px-2">
          <Logo />
        </div>

        <div>
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
          <div className="flex flex-col gap-1">
            {ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
                  }`}
                >
                  <Icon />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full rounded-md border border-border px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground disabled:opacity-60"
        >
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>
    </nav>
  );
}
