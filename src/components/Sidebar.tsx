"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="2" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="2" width="13" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 8.5l1.7 1.7L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="4" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7" y="2" width="4" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="2" width="4" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7h14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 2v3M12.5 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BunkerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 2l7 3.5v3c0 4-3 7-7 7.5-4-.5-7-3.5-7-7.5v-3L9 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 6v6M6.5 8.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SocialMediaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 8v2a1 1 0 0 0 1 1h1l3 3V4L5 7H4a1 1 0 0 0-1 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d="M11 6.5c.8.6 1.3 1.5 1.3 2.5s-.5 1.9-1.3 2.5M13 4.5c1.5 1.1 2.4 2.7 2.4 4.5S14.5 12.4 13 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ActiveKey = "dashboard" | "tasks" | "conteudos" | "calendario" | "bunker";

type NavItemDef = { href: string; label: string; key: ActiveKey; icon: () => React.JSX.Element };

const STANDALONE_ITEMS: NavItemDef[] = [
  { href: "", label: "Dashboard", key: "dashboard", icon: DashboardIcon },
  { href: "/tasks", label: "Tasks", key: "tasks", icon: TasksIcon },
];

const SOCIAL_MEDIA_ITEMS: NavItemDef[] = [
  { href: "/conteudos", label: "Conteúdos", key: "conteudos", icon: ContentIcon },
  { href: "/calendario", label: "Calendário", key: "calendario", icon: CalendarIcon },
  { href: "/bunker", label: "Bunker", key: "bunker", icon: BunkerIcon },
];

const SOCIAL_MEDIA_KEYS: ActiveKey[] = ["conteudos", "calendario", "bunker"];

function NavLink({
  clientId,
  accessKey,
  item,
  isActive,
}: {
  clientId: string;
  accessKey: string;
  item: NavItemDef;
  isActive: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={`/${clientId}${item.href}?key=${encodeURIComponent(accessKey)}`}
      className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-brand-primary/10 text-brand-primary"
          : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
      }`}
    >
      {isActive && (
        <span className="absolute -left-4 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-primary" aria-hidden="true" />
      )}
      <Icon />
      {item.label}
    </Link>
  );
}

export function Sidebar({
  clientId,
  accessKey,
  active,
}: {
  clientId: string;
  accessKey: string;
  active: ActiveKey;
}) {
  const isSocialActive = SOCIAL_MEDIA_KEYS.includes(active);
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const socialOpen = isSocialActive || manuallyOpen;

  return (
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-card px-4 py-6">
      <div className="px-2">
        <Logo />
      </div>

      <div>
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Menu</p>
        <div className="flex flex-col gap-1">
          {STANDALONE_ITEMS.map((item) => (
            <NavLink key={item.href} clientId={clientId} accessKey={accessKey} item={item} isActive={active === item.key} />
          ))}

          <button
            type="button"
            onClick={() => setManuallyOpen((o) => !o)}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
              isSocialActive ? "text-brand-primary" : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
            }`}
          >
            <SocialMediaIcon />
            <span className="flex-1">Social Media</span>
            <ChevronIcon open={socialOpen} />
          </button>

          {socialOpen && (
            <div className="ml-3 flex flex-col gap-1 border-l border-border pl-3">
              {SOCIAL_MEDIA_ITEMS.map((item) => (
                <NavLink key={item.href} clientId={clientId} accessKey={accessKey} item={item} isActive={active === item.key} />
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
