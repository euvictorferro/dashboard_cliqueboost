"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/layout/Logo";
import { AccountCard } from "@/components/layout/AccountCard";
import { ReferralPromoCard } from "@/components/layout/ReferralPromoCard";
import { isProductionEnv } from "@/lib/env";
import { TOUR_OPEN_SOCIAL_EVENT } from "@/lib/onboardingTour";

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

function AtasIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6h6M6 9h6M6 12h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BoosterAiIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 8.5c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5-2.7 5.5-6 5.5c-.7 0-1.4-.1-2-.3L4 15l.8-2.8C3.7 11.1 3 9.9 3 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="6.5" cy="8.5" r="0.9" fill="currentColor" />
      <circle cx="9" cy="8.5" r="0.9" fill="currentColor" />
      <circle cx="11.5" cy="8.5" r="0.9" fill="currentColor" />
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

export type ActiveKey = "dashboard" | "tasks" | "atas" | "booster-ai" | "conta" | "conteudos" | "calendario" | "bunker";

type NavItemDef = { href: string; label: string; key: ActiveKey; icon: () => React.JSX.Element };

const ITEMS_BEFORE_SOCIAL: NavItemDef[] = [
  { href: "", label: "Dashboard", key: "dashboard", icon: DashboardIcon },
  { href: "/tasks", label: "Tasks", key: "tasks", icon: TasksIcon },
];

const ITEMS_AFTER_SOCIAL: NavItemDef[] = [
  { href: "/atas", label: "Atas", key: "atas", icon: AtasIcon },
  { href: "/booster-ai", label: "Booster AI", key: "booster-ai", icon: BoosterAiIcon },
];

const SOCIAL_MEDIA_ITEMS: NavItemDef[] = [
  { href: "/conteudos", label: "Conteúdos", key: "conteudos", icon: ContentIcon },
  { href: "/calendario", label: "Calendário", key: "calendario", icon: CalendarIcon },
  { href: "/bunker", label: "Bunker", key: "bunker", icon: BunkerIcon },
];

const SOCIAL_MEDIA_KEYS: ActiveKey[] = ["conteudos", "calendario", "bunker"];

// ponytail: Bunker fica em backlog — some da navegação em produção, continua visível em preview.
function visibleSocialMediaItems(): NavItemDef[] {
  return isProductionEnv() ? SOCIAL_MEDIA_ITEMS.filter((item) => item.key !== "bunker") : SOCIAL_MEDIA_ITEMS;
}

function NavLink({
  clientId,
  item,
  isActive,
}: {
  clientId: string;
  item: NavItemDef;
  isActive: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={`/${clientId}${item.href}`}
      data-tour={`nav-${item.key}`}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
        isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
      }`}
    >
      <Icon />
      {item.label}
    </Link>
  );
}

export function Sidebar({
  clientId,
  active,
  pageLabel,
  collapsed = false,
}: {
  clientId: string;
  active: ActiveKey;
  pageLabel: string;
  collapsed?: boolean;
}) {
  const isSocialActive = SOCIAL_MEDIA_KEYS.includes(active);
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const socialOpen = isSocialActive || manuallyOpen;

  // Tour de onboarding: abre o submenu Social Media na marra quando o passo aponta pro item
  // Conteúdos/Calendário e a página atual não é uma delas (submenu ficaria fechado por padrão).
  useEffect(() => {
    function handleOpenSocial() {
      setManuallyOpen(true);
    }
    window.addEventListener(TOUR_OPEN_SOCIAL_EVENT, handleOpenSocial);
    return () => window.removeEventListener(TOUR_OPEN_SOCIAL_EVENT, handleOpenSocial);
  }, []);

  return (
    <nav
      className={`sticky top-0 h-screen shrink-0 overflow-hidden border-r border-border bg-card transition-[width] duration-200 ${
        collapsed ? "w-0 border-none" : "w-56"
      }`}
    >
      <div className="flex h-full w-56 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
          <div className="px-2">
            <Logo />
          </div>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("cliqueboost:open-cmdk"))}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <span className="flex-1">Buscar...</span>
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
          </button>

          <div>
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Menu</p>
            <div className="flex flex-col gap-1">
              {ITEMS_BEFORE_SOCIAL.map((item) => (
                <NavLink key={item.href} clientId={clientId} item={item} isActive={active === item.key} />
              ))}

              <button
                type="button"
                onClick={() => setManuallyOpen((o) => !o)}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                  isSocialActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
                }`}
              >
                <SocialMediaIcon />
                <span className="flex-1">Social Media</span>
                <ChevronIcon open={socialOpen} />
              </button>

            {socialOpen && (
              <div className="ml-3 flex flex-col gap-1 border-l border-border pl-3">
                {visibleSocialMediaItems().map((item) => (
                  <NavLink key={item.href} clientId={clientId} item={item} isActive={active === item.key} />
                ))}
              </div>
            )}

              {ITEMS_AFTER_SOCIAL.map((item) => (
                <NavLink key={item.href} clientId={clientId} item={item} isActive={active === item.key} />
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <ReferralPromoCard clientId={clientId} />
          <AccountCard clientId={clientId} pageLabel={pageLabel} />
        </div>
      </div>
    </nav>
  );
}
