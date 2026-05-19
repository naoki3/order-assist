'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { Lang, TranslationKey } from '@/lib/i18n';
import { translations } from '@/lib/i18n';
import { toLocalDateStr, DEFAULT_TZ } from '@/lib/tz';

interface LangContext {
  lang: Lang;
  setLang: (lang: Lang) => void;
  tz: string;
  setTz: (tz: string) => void;
  localDate: (date?: Date) => string;
  t: (key: TranslationKey) => string;
  tf: <T>(key: TranslationKey, ...args: unknown[]) => T;
}

const Ctx = createContext<LangContext>({
  lang: 'ja',
  setLang: () => {},
  tz: DEFAULT_TZ,
  setTz: () => {},
  localDate: () => '',
  t: (key) => key,
  tf: (key) => key as unknown as never,
});

export function useT() {
  return useContext(Ctx);
}

export function LanguageProvider({
  initialLang,
  initialTz = DEFAULT_TZ,
  children,
}: {
  initialLang: Lang;
  initialTz?: string;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [tz, setTzState] = useState<string>(initialTz);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.cookie = `lang=${next};path=/;max-age=31536000`;
  }, []);

  const setTz = useCallback((next: string) => {
    setTzState(next);
    document.cookie = `tz=${encodeURIComponent(next)};path=/;max-age=31536000`;
  }, []);

  const localDate = useCallback((date?: Date) => toLocalDateStr(tz, date), [tz]);

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
    <Ctx.Provider value={{ lang, setLang, tz, setTz, localDate, t: tFn, tf: tfFn }}>
      {children}
    </Ctx.Provider>
  );
}
