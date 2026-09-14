"use client";

import Link from "next/link";
import type { ActiveKey } from "@/components/layout/Sidebar";

function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="4" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7" y="2" width="4" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="2" width="4" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="2" width="13" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 8.5l1.7 1.7L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7h14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 2v3M12.5 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ContaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 15c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type TabDef = { href: string; label: string; key: ActiveKey; icon: () => React.JSX.Element };

const TABS: TabDef[] = [
  { href: "", label: "Dashboard", key: "dashboard", icon: DashboardIcon },
  { href: "/conteudos", label: "Conteúdos", key: "conteudos", icon: ContentIcon },
  { href: "/tasks", label: "Tarefas", key: "tasks", icon: TasksIcon },
  { href: "/calendario", label: "Calendário", key: "calendario", icon: CalendarIcon },
  { href: "/conta", label: "Conta", key: "conta", icon: ContaIcon },
];

export function BottomTabBar({ clientId, active }: { clientId: string; active: ActiveKey }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/${clientId}${tab.href}`}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
