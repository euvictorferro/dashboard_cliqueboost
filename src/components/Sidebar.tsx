import Link from "next/link";
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

const NAV_ITEMS = [
  { href: "", label: "Dashboard", key: "dashboard", icon: DashboardIcon },
  { href: "/tasks", label: "Tasks", key: "tasks", icon: TasksIcon },
] as const;

export function Sidebar({
  clientId,
  accessKey,
  active,
}: {
  clientId: string;
  accessKey: string;
  active: "dashboard" | "tasks";
}) {
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-6 border-r border-border bg-card px-4 py-6">
      <div className="px-2">
        <Logo />
      </div>

      <div>
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Menu</p>
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.key;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
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
          })}
        </div>
      </div>
    </nav>
  );
}
