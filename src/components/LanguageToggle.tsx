'use client';

import { useT } from './LanguageProvider';

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useT();

  function toggle() {
    const next = lang === 'ja' ? 'en' : 'ja';
    setLang(next);
    window.location.reload();
  }

  if (compact) {
    return (
      <button
        onClick={toggle}
        className="px-2 py-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors text-sm font-medium leading-none"
        aria-label="Switch language"
      >
        {lang === 'ja' ? 'EN' : 'JA'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 w-full transition-colors"
      aria-label="Switch language"
    >
      <span>{lang === 'ja' ? '🇯🇵' : '🇺🇸'}</span>
      <span>{lang === 'ja' ? 'English' : '日本語'}</span>
    </button>
  );
}
