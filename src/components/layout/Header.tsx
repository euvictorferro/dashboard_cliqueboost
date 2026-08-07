"use client";

function CollapseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 2.5v11" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function Header({
  clientName,
  pageLabel,
  collapsed,
  onToggleCollapse,
}: {
  clientName: string;
  pageLabel: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Mostrar menu" : "Esconder menu"}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground"
      >
        <CollapseIcon />
      </button>
      <p className="text-sm text-muted-foreground">
        {clientName} / <span className="font-medium text-card-foreground">{pageLabel}</span>
      </p>
    </header>
  );
}
