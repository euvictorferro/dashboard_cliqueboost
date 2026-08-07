"use client";

import { useEffect, useState } from "react";
import { getInitials, colorFromName } from "@/lib/avatar";
import { UserIcon, ClockIcon, CreditCardIcon, LinkIcon, LockIcon } from "@/components/conta/ContaIcons";

export type ContaSection = "perfil" | "fuso" | "faturamento" | "indicacoes" | "seguranca";

const NAV_ITEMS: { id: ContaSection; label: string; Icon: () => React.ReactElement }[] = [
  { id: "perfil", label: "Perfil", Icon: UserIcon },
  { id: "fuso", label: "Fuso horário", Icon: ClockIcon },
  { id: "faturamento", label: "Faturamento", Icon: CreditCardIcon },
  { id: "indicacoes", label: "Indicação de amigos", Icon: LinkIcon },
  { id: "seguranca", label: "Segurança", Icon: LockIcon },
];

export function ContaSidebar({
  clientName,
  email,
  logoUrl,
}: {
  clientName: string;
  email: string;
  logoUrl: string | null;
}) {
  const initials = getInitials(clientName);
  const avatarColor = colorFromName(clientName);
  const [active, setActive] = useState<ContaSection>("perfil");

  // ponytail: scroll-spy simples via IntersectionObserver — a página agora é uma rolagem única
  // com todas as seções, então o "ativo" segue o scroll em vez de trocar o conteúdo visível.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id as ContaSection);
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    for (const { id } of NAV_ITEMS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sticky top-20 w-60 shrink-0 self-start">
      <div className="mb-6 flex flex-col items-start gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={clientName} className="h-20 w-20 rounded-full border border-border object-cover" />
        ) : (
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold text-white"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-card-foreground">{clientName}</p>
          <p className="truncate text-xs text-muted-foreground">{email || "..."}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <a
              key={id}
              href={`#${id}`}
              className={`flex items-center gap-2.5 rounded-md border-l-2 py-2 pl-3 pr-2 text-left text-sm transition-colors ${
                isActive
                  ? "border-brand-primary bg-brand-primary/5 font-semibold text-brand-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-card-foreground"
              }`}
            >
              <Icon />
              {label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
