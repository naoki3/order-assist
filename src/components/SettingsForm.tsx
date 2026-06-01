'use client';

import { useT } from './LanguageProvider';
import LanguageToggle from './LanguageToggle';
import { SUPPORTED_TZ } from '@/lib/tz';
import type { Currency } from '@/lib/currency';
import { useState } from 'react';

export default function SettingsForm() {
  const { t, tz, setTz, currency, setCurrency } = useT();
  const currencyOptions: { value: Currency; label: string }[] = [
    { value: 'JPY', label: t('settings.currencyJPY') },
    { value: 'USD', label: t('settings.currencyUSD') },
    { value: 'EUR', label: t('settings.currencyEUR') },
    { value: 'GBP', label: t('settings.currencyGBP') },
  ];
  const [saved, setSaved] = useState(false);

  function handleTzChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setTz(e.target.value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleCurrencyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setCurrency(e.target.value as Currency);
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

        <div className="border-t border-slate-100 pt-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {t('settings.currency')}
          </label>
          <p className="text-xs text-slate-400 mb-2">{t('settings.currencyDesc')}</p>
          <select
            value={currency}
            onChange={handleCurrencyChange}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            {currencyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {saved && (
        <p className="text-green-600 text-sm font-medium text-center">{t('settings.saved')}</p>
      )}
    </div>
  );
}
