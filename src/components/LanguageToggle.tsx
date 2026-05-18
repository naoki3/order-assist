'use client';

import { useT } from './LanguageProvider';
import { useRouter } from 'next/navigation';

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useT();
  const router = useRouter();

  function toggle() {
    const next = lang === 'ja' ? 'en' : 'ja';
    setLang(next);
    router.refresh();
  }

  if (compact) {
    return (
      <button
        onClick={toggle}
        className="px-2 py-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors text-base leading-none"
        aria-label="Switch language"
      >
        {lang === 'ja' ? '🇯🇵' : '🇺🇸'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 w-full transition-colors"
      aria-label="Switch language"
    >
      <span className="text-base leading-none">{lang === 'ja' ? '🇯🇵' : '🇺🇸'}</span>
      <span>{lang === 'ja' ? 'English' : '日本語'}</span>
    </button>
  );
}
