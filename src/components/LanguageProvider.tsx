'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { Lang, TranslationKey } from '@/lib/i18n';
import { translations } from '@/lib/i18n';
import { toLocalDateStr, DEFAULT_TZ } from '@/lib/tz';
import type { Currency } from '@/lib/currency';
import { CURRENCY_SYMBOLS } from '@/lib/currency';

interface LangContext {
  lang: Lang;
  setLang: (lang: Lang) => void;
  tz: string;
  setTz: (tz: string) => void;
  localDate: (date?: Date) => string;
  t: (key: TranslationKey) => string;
  tf: <T>(key: TranslationKey, ...args: unknown[]) => T;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  currencySymbol: string;
}

const Ctx = createContext<LangContext>({
  lang: 'ja',
  setLang: () => {},
  tz: DEFAULT_TZ,
  setTz: () => {},
  localDate: () => '',
  t: (key) => key,
  tf: (key) => key as unknown as never,
  currency: 'JPY',
  setCurrency: () => {},
  currencySymbol: '¥',
});

export function useT() {
  return useContext(Ctx);
}

export function LanguageProvider({
  initialLang,
  initialTz = DEFAULT_TZ,
  initialCurrency = 'JPY',
  children,
}: {
  initialLang: Lang;
  initialTz?: string;
  initialCurrency?: Currency;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [tz, setTzState] = useState<string>(initialTz);
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.cookie = `lang=${next};path=/;max-age=31536000`;
  }, []);

  const setTz = useCallback((next: string) => {
    setTzState(next);
    document.cookie = `tz=${encodeURIComponent(next)};path=/;max-age=31536000`;
  }, []);

  const setCurrency = useCallback((next: Currency) => {
    setCurrencyState(next);
    document.cookie = `currency=${next};path=/;max-age=31536000`;
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

  const currencySymbol = CURRENCY_SYMBOLS[currency];

  return (
    <Ctx.Provider value={{ lang, setLang, tz, setTz, localDate, t: tFn, tf: tfFn, currency, setCurrency, currencySymbol }}>
      {children}
    </Ctx.Provider>
  );
}
