export function InfoTooltip({ text, position = "top" }: { text: string; position?: "top" | "bottom" }) {
  const positionClasses =
    position === "top" ? "bottom-full mb-2" : "top-full mt-2";
  return (
    <span className="group relative inline-flex">
      <span className="flex h-4 w-4 cursor-default items-center justify-center rounded-full border border-muted-foreground/50 text-[10px] leading-none text-muted-foreground">
        i
      </span>
      <span
        className={`pointer-events-none absolute left-1/2 z-10 w-48 -translate-x-1/2 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100 ${positionClasses}`}
      >
        {text}
      </span>
    </span>
  );
}
