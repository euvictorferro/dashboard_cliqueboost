// ponytail: "left" existe pro caso do botão de PDF no header — ele fica perto do topo e da borda
// direita da página, então tanto "top" (corta em cima quando a página está no topo) quanto
// "bottom" (cobre a linha do filtro de período logo abaixo) tinham espaço insuficiente. Abrir pro
// lado, centralizado na vertical, evita as duas bordas de uma vez.
const POSITION_CLASSES = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
} as const;

export function InfoTooltip({
  text,
  position = "top",
}: {
  text: string;
  position?: keyof typeof POSITION_CLASSES;
}) {
  return (
    <span className="group relative inline-flex">
      <span className="flex h-4 w-4 cursor-default items-center justify-center rounded-full border border-muted-foreground/50 text-[10px] leading-none text-muted-foreground">
        i
      </span>
      <span
        className={`pointer-events-none absolute z-10 w-48 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100 ${POSITION_CLASSES[position]}`}
      >
        {text}
      </span>
    </span>
  );
}
