"use client";

import type { ReactNode } from "react";

const BADGE_TONE_CLASSES = {
  success: "bg-brand-success/10 text-brand-success",
  warning: "bg-amber-500/10 text-amber-600",
} as const;

export type ContaFieldBadge = { label: string; tone: keyof typeof BADGE_TONE_CLASSES };

export function ContaField({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: ContaFieldBadge;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md bg-muted px-3 py-2.5 text-sm font-medium text-card-foreground">
          {children}
        </div>
        {badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE_CLASSES[badge.tone]}`}>
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}
