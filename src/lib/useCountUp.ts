"use client";

import { useEffect, useRef, useState } from "react";

// Anima um número subindo (ou descendo) até o valor real assim que ele muda — usado nos cards
// de métrica pra a transição "0 -> valor real" (ou "valor antigo -> novo" ao trocar o período)
// não parecer um salto seco. Sem efeito no primeiro render (display já nasce igual ao target).
export function useCountUp(target: number, durationMs = 650): number {
  const [display, setDisplay] = useState(target);
  const lastRef = useRef(target);

  useEffect(() => {
    const from = lastRef.current;
    if (from === target) return;

    let raf = 0;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const value = Math.round(from + (target - from) * eased);
      setDisplay(value);
      lastRef.current = value;
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        lastRef.current = target;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}
