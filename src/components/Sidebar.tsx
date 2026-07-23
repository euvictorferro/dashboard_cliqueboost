import Link from "next/link";

const NAV_ITEMS = [
  { href: "", label: "Dashboard", key: "dashboard" },
  { href: "/tasks", label: "Tasks", key: "tasks" },
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
    <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-border p-4">
      {NAV_ITEMS.map((item) => {
        const href = `/${clientId}${item.href}`;
        const isActive = active === item.key;
        return (
          <Link
            key={item.href}
            href={`${href}?key=${encodeURIComponent(accessKey)}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-brand-primary text-white"
                : "text-muted-foreground hover:bg-muted hover:text-card-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
