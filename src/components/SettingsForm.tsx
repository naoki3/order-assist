'use client';

import { useT } from './LanguageProvider';
import LanguageToggle from './LanguageToggle';
import { SUPPORTED_TZ } from '@/lib/tz';
import { useState } from 'react';

export default function SettingsForm() {
  const { t, tz, setTz } = useT();
  const [saved, setSaved] = useState(false);

  function handleTzChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setTz(e.target.value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {t('settings.timezone')}
          </label>
          <p className="text-xs text-slate-400 mb-2">{t('settings.timezoneDesc')}</p>
          <select
            value={tz}
            onChange={handleTzChange}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            {SUPPORTED_TZ.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">{t('settings.language')}</p>
          <LanguageToggle />
        </div>
      </div>

      {saved && (
        <p className="text-green-600 text-sm font-medium text-center">{t('settings.saved')}</p>
      )}
    </div>
  );
}
