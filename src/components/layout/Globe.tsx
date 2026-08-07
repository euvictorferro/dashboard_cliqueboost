"use client";

import createGlobe, { type COBEOptions } from "cobe";
import { useCallback, useEffect, useRef } from "react";

// ponytail: onRender existe no runtime do cobe mas falta na tipagem v2 — estende só o que usamos.
type GlobeOptions = COBEOptions & { onRender: (state: Record<string, number>) => void };

// ponytail: globo do cobe adaptado do componente cosmic-404. markerColor na roxa da marca
// (brand-primary ~ 263 84% 52%) em vez do laranja original; markers com São Paulo em destaque.
const GLOBE_CONFIG: COBEOptions = {
  width: 600,
  height: 600,
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 0,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  baseColor: [1, 1, 1],
  markerColor: [124 / 255, 58 / 255, 237 / 255],
  glowColor: [1, 1, 1],
  markers: [
    { location: [-23.5505, -46.6333], size: 0.12 },
    { location: [40.7128, -74.006], size: 0.08 },
    { location: [41.0082, 28.9784], size: 0.05 },
    { location: [34.6937, 135.5022], size: 0.05 },
  ],
};

export function Globe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const widthRef = useRef(0);

  const onRender = useCallback((state: Record<string, number>) => {
    phiRef.current += 0.005;
    state.phi = phiRef.current;
    state.width = widthRef.current * 2;
    state.height = widthRef.current * 2;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      widthRef.current = canvas.offsetWidth;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // ponytail: variável tipada (não literal inline) pra que a prop extra onRender passe no
    // excess-property-check do argumento COBEOptions.
    const opts: GlobeOptions = {
      ...GLOBE_CONFIG,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      onRender,
    };
    const globe = createGlobe(canvas, opts);

    return () => {
      globe.destroy();
      window.removeEventListener("resize", handleResize);
    };
  }, [onRender]);

  return (
    <div className={`relative aspect-square w-full ${className ?? ""}`}>
      <canvas ref={canvasRef} className="size-full [contain:layout_paint_size]" />
    </div>
  );
}
