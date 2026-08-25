"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActiveKey } from "@/components/layout/Sidebar";
import {
  TOUR_STEPS,
  TOUR_PAGE_PATH,
  TOUR_ACTIVE_KEY,
  TOUR_STEP_KEY,
  TOUR_START_EVENT,
  TOUR_OPEN_SOCIAL_EVENT,
  TOUR_TARGETS_INSIDE_SOCIAL_MENU,
} from "@/lib/onboardingTour";

type Rect = { top: number; left: number; width: number; height: number };

async function markOnboardingSeen() {
  try {
    await fetch("/api/auth/onboarding", { method: "POST" });
  } catch {
    // ponytail: se falhar, o tour não incomoda de novo nessa aba (localStorage já foi limpo
    // pelo caller) — na pior hipótese volta a aparecer numa sessão futura, sem travar nada.
  }
}

export function OnboardingTour({ clientId, active, hasSeenOnboarding }: { clientId: string; active: ActiveKey; hasSeenOnboarding: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  // Decide se o tour está rodando: começa sozinho no primeiro acesso (sem registro nenhum no
  // localStorage ainda e o servidor confirma que o cliente nunca viu), ou retoma de onde parou
  // se já estava em andamento (persistido pra sobreviver à navegação entre páginas).
  useEffect(() => {
    function readStoredStep(): number | null {
      if (typeof window === "undefined") return null;
      if (window.localStorage.getItem(TOUR_ACTIVE_KEY) !== "1") return null;
      const raw = window.localStorage.getItem(TOUR_STEP_KEY);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) ? n : 0;
    }

    const stored = readStoredStep();
    if (stored !== null) {
      setStep(stored);
    } else if (!hasSeenOnboarding && window.localStorage.getItem(TOUR_ACTIVE_KEY) === null) {
      window.localStorage.setItem(TOUR_ACTIVE_KEY, "1");
      window.localStorage.setItem(TOUR_STEP_KEY, "0");
      setStep(0);
    }

    function handleForceStart() {
      window.localStorage.setItem(TOUR_ACTIVE_KEY, "1");
      window.localStorage.setItem(TOUR_STEP_KEY, "0");
      if (active !== "dashboard") {
        router.push(`/${clientId}`);
      } else {
        setStep(0);
      }
    }
    window.addEventListener(TOUR_START_EVENT, handleForceStart);
    return () => window.removeEventListener(TOUR_START_EVENT, handleForceStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSeenOnboarding]);

  const currentStep = step !== null ? TOUR_STEPS[step] : null;
  const onThisPage = currentStep?.page === active;

  // Tour aponta pra um item dentro do submenu Social Media, fechado por padrão fora das
  // páginas dele — manda a Sidebar abrir antes de tentar medir o elemento.
  useEffect(() => {
    if (currentStep && onThisPage && TOUR_TARGETS_INSIDE_SOCIAL_MENU.includes(currentStep.target)) {
      window.dispatchEvent(new Event(TOUR_OPEN_SOCIAL_EVENT));
    }
  }, [currentStep, onThisPage]);

  // Mede o elemento-alvo e mantém a posição atualizada (resize, scroll, mudanças de layout).
  useEffect(() => {
    if (!currentStep || !onThisPage) {
      setRect(null);
      return;
    }
    let raf = 0;
    function measure() {
      const el = document.querySelector(`[data-tour="${currentStep!.target}"]`);
      if (!el) {
        setRect(null);
      } else {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
      raf = requestAnimationFrame(measure);
    }
    measure();
    return () => cancelAnimationFrame(raf);
  }, [currentStep, onThisPage]);

  function endTour() {
    window.localStorage.removeItem(TOUR_ACTIVE_KEY);
    window.localStorage.removeItem(TOUR_STEP_KEY);
    setStep(null);
    markOnboardingSeen();
  }

  function goNext() {
    if (step === null) return;
    const next = step + 1;
    if (next >= TOUR_STEPS.length) {
      endTour();
      return;
    }
    window.localStorage.setItem(TOUR_STEP_KEY, String(next));
    const nextPage = TOUR_STEPS[next].page;
    if (nextPage !== active) {
      router.push(`/${clientId}${TOUR_PAGE_PATH[nextPage]}`);
    } else {
      setStep(next);
    }
  }

  if (step === null || !currentStep) return null;
  const isLast = step === TOUR_STEPS.length - 1;

  // Passo aponta pra outra página (cliente ainda não navegou até lá) — não desenha nada aqui.
  if (!onThisPage || !rect) return null;

  const PADDING = 8;
  const spotTop = rect.top - PADDING;
  const spotLeft = rect.left - PADDING;
  const spotWidth = rect.width + PADDING * 2;
  const spotHeight = rect.height + PADDING * 2;

  const tooltipBelow = spotTop + spotHeight + 160 < window.innerHeight;
  const tooltipTop = tooltipBelow ? spotTop + spotHeight + 12 : Math.max(12, spotTop - 12);
  const tooltipLeft = Math.min(Math.max(spotLeft, 12), window.innerWidth - 300);

  return (
    <div className="fixed inset-0 z-[150]">
      {/* Recorte "spotlight": box-shadow gigante escurece tudo, exceto o retângulo do alvo. */}
      <div
        className="pointer-events-none absolute rounded-lg ring-2 ring-brand-primary transition-all duration-200"
        style={{
          top: spotTop,
          left: spotLeft,
          width: spotWidth,
          height: spotHeight,
          boxShadow: "0 0 0 9999px rgba(15, 15, 20, 0.35)",
        }}
      />

      <div
        className="absolute w-72 rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)] transition-all duration-200"
        style={{ top: tooltipTop, left: tooltipLeft, transform: tooltipBelow ? undefined : "translateY(-100%)" }}
      >
        <p className="mb-1 text-sm font-semibold text-card-foreground">{currentStep.title}</p>
        <p className="mb-3 text-xs text-muted-foreground">{currentStep.text}</p>
        <div className="flex items-center justify-between">
          <button onClick={endTour} className="text-xs font-medium text-muted-foreground hover:text-card-foreground">
            Pular tour
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {step + 1}/{TOUR_STEPS.length}
            </span>
            <button
              onClick={goNext}
              className="rounded-full bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              {isLast ? "Concluir" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
