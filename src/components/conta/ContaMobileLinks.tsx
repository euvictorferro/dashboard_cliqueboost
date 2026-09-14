// src/components/conta/ContaMobileLinks.tsx
import Link from "next/link";
import { isProductionEnv } from "@/lib/env";

export function ContaMobileLinks({ clientId }: { clientId: string }) {
  return (
    <section id="mais" className="md:hidden">
      <h2 className="mb-3 text-sm font-semibold text-card-foreground">Mais</h2>
      <div className="flex flex-col divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
        <Link href={`/${clientId}/atas`} className="px-4 py-3 text-sm text-card-foreground">
          Atas
        </Link>
        {!isProductionEnv() && (
          <Link href={`/${clientId}/bunker`} className="px-4 py-3 text-sm text-card-foreground">
            Bunker
          </Link>
        )}
      </div>
    </section>
  );
}
