// src/components/layout/MobileHeader.tsx
export function MobileHeader({ pageLabel }: { pageLabel: string }) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-20 flex h-[52px] items-center border-b border-border bg-card px-4"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <p className="text-sm font-medium text-card-foreground">{pageLabel}</p>
    </header>
  );
}
