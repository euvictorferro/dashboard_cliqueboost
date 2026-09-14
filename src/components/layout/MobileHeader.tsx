// src/components/layout/MobileHeader.tsx
export function MobileHeader({ pageLabel }: { pageLabel: string }) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-20 flex h-[calc(52px+env(safe-area-inset-top))] items-center border-b border-border bg-card px-4 pt-[env(safe-area-inset-top)] md:hidden"
    >
      <p className="text-sm font-medium text-card-foreground">{pageLabel}</p>
    </header>
  );
}
