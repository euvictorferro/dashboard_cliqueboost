// src/lib/env.ts
// ponytail: só isso — checagem única de "é produção de verdade?", pro client bundle
// (NEXT_PUBLIC_VERCEL_ENV é injetado em next.config.ts a partir de VERCEL_ENV).
export function isProductionEnv(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}
