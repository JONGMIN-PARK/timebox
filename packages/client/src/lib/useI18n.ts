import { useState, useEffect, useCallback } from "react";
import { t as translate, setLocale as setLang, getLocale, type Locale } from "./i18n";

export function useI18n() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    window.addEventListener("locale-changed", handler);
    return () => window.removeEventListener("locale-changed", handler);
  }, []);

  const t = useCallback((key: string) => translate(key), []);
  const setLocale = useCallback((locale: Locale) => setLang(locale), []);
  const locale = getLocale();

  return { t, setLocale, locale };
}
