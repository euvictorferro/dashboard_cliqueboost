// src/components/AssigneeAvatars.tsx
"use client";

export type Assignee = { name: string; avatarUrl?: string | null; initials: string; color?: string };

const SIZE_CLASSES = {
  sm: { wrapper: "h-7 w-7", text: "text-[11px]" },
  xs: { wrapper: "h-6 w-6", text: "text-[10px]" },
} as const;

export function AssigneeAvatars({
  assignees,
  size = "sm",
  emptyLabel,
}: {
  assignees: Assignee[];
  size?: keyof typeof SIZE_CLASSES;
  emptyLabel?: string;
}) {
  if (assignees.length === 0) {
    return emptyLabel ? <span className="text-xs text-muted-foreground">{emptyLabel}</span> : null;
  }
  const { wrapper, text } = SIZE_CLASSES[size];
  return (
    <div className="flex items-center -space-x-2">
      {assignees.map((a) => (
        <span
          key={a.name}
          title={a.name}
          className={`relative ${wrapper} shrink-0 overflow-hidden rounded-full border-2 border-card`}
        >
          {a.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar vem de URL externa (ClickUp/Trello)
            <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className={`flex h-full w-full items-center justify-center ${text} font-semibold text-white`}
              style={{ backgroundColor: a.color ?? "#8590a2" }}
            >
              {a.initials}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
