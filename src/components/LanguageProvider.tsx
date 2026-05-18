'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Lang, TranslationKey } from '@/lib/i18n';
import { translations } from '@/lib/i18n';

interface LangContext {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  tf: <T>(key: TranslationKey, ...args: unknown[]) => T;
}

const Ctx = createContext<LangContext>({
  lang: 'ja',
  setLang: () => {},
  t: (key) => key,
  tf: (key) => key as unknown as never,
});

export function useT() {
  return useContext(Ctx);
}

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.cookie = `lang=${next};path=/;max-age=31536000`;
  }, []);

  // Sync with cookie on first mount (covers SSR mismatch)
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)lang=([^;]+)/);
    const cookieLang = match?.[1] === 'en' ? 'en' : 'ja';
    if (cookieLang !== lang) setLangState(cookieLang);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dict = translations[lang] as Record<string, unknown>;

  const tFn = useCallback(
    (key: TranslationKey): string => {
      const val = dict[key];
      return typeof val === 'string' ? val : key;
    },
    [dict]
  );

  const tfFn = useCallback(
    <T,>(key: TranslationKey, ...args: unknown[]): T => {
      const val = dict[key];
      if (typeof val === 'function') return (val as (...a: unknown[]) => T)(...args);
      return val as T;
    },
    [dict]
  );

  return (
    <Ctx.Provider value={{ lang, setLang, t: tFn, tf: tfFn }}>
      {children}
    </Ctx.Provider>
  );
}
