import { Logo } from "./Logo";

// ponytail: as duas curvas abaixo recriam à mão o mesmo estilo de sparkline usado de verdade
// nos cards de métrica do Dashboard (MetricCard.tsx: recharts, stroke brand-primary/brand-accent,
// monotone, sem pontos) — não é decoração genérica, é o mesmo vocabulário visual do que o
// cliente vê depois de entrar. Coordenadas desenhadas à mão pra parecer orgânico, não geradas.
function GrowthLines() {
  return (
    <svg
      viewBox="0 0 600 150"
      fill="none"
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-28 w-full text-white"
      preserveAspectRatio="none"
    >
      <path
        d="M-10 110 C 60 95, 90 130, 150 105 S 250 55, 320 70 S 430 35, 500 42 S 580 10, 610 5"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="login-hero-line"
      />
      <path
        d="M-10 135 C 70 130, 100 100, 170 112 S 260 92, 330 98 S 420 65, 490 60 S 570 32, 610 25"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="login-hero-line login-hero-line--accent"
      />
    </svg>
  );
}

export function LoginHero() {
  return (
    <div
      className="relative hidden h-full flex-col overflow-hidden px-12 py-10 text-white lg:flex"
      style={{
        background: "linear-gradient(155deg, hsl(var(--brand-primary)) 0%, hsl(var(--brand-accent)) 100%)",
      }}
    >
      <Logo />

      <div className="relative z-10 mt-auto mb-24 max-w-md">
        <h1 className="font-display text-[2.75rem] italic leading-[1.08] tracking-tight text-balance">
          Seu alcance.
          <br />
          Sua audiência.
          <br />
          Seu crescimento.
        </h1>
        <p className="mt-5 text-sm text-white/75">Tudo o que sua marca precisa, em um só lugar.</p>
      </div>

      <GrowthLines />
    </div>
  );
}
