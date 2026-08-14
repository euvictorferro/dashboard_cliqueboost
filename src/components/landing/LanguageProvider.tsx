"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { landingCopy, type Locale, type LandingCopy } from "@/lib/landingCopy";

const STORAGE_KEY = "landing-locale";

type LanguageContextValue = { locale: Locale; toggleLocale: () => void };

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  // ponytail: lê a preferência salva só depois do mount pra evitar mismatch de hydration
  // (localStorage não existe no server).
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "en" || saved === "pt") setLocale(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-BR" : "en";
  }, [locale]);

  function toggleLocale() {
    setLocale((prev) => {
      const next: Locale = prev === "en" ? "pt" : "en";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return <LanguageContext.Provider value={{ locale, toggleLocale }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

export function useLandingCopy(): LandingCopy {
  const { locale } = useLanguage();
  return landingCopy[locale];
}
