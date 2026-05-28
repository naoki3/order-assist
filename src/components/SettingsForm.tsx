'use client';

import { useT } from './LanguageProvider';
import LanguageToggle from './LanguageToggle';
import { SUPPORTED_TZ } from '@/lib/tz';
import type { Currency } from '@/lib/currency';
import { useState, useActionState } from 'react';
import { updateDefaultWarehouse } from '@/lib/actions';
import { useActionFeedback } from '@/hooks/useActionFeedback';

interface Props {
  warehouses?: { id: number; name: string }[];
  defaultWarehouseId?: number | null;
}

export default function SettingsForm({ warehouses = [], defaultWarehouseId = null }: Props) {
  const { t, tz, setTz, currency, setCurrency } = useT();
  const currencyOptions: { value: Currency; label: string }[] = [
    { value: 'JPY', label: t('settings.currencyJPY') },
    { value: 'USD', label: t('settings.currencyUSD') },
    { value: 'EUR', label: t('settings.currencyEUR') },
    { value: 'GBP', label: t('settings.currencyGBP') },
  ];
  const [localSaved, setLocalSaved] = useState(false);
  const [whState, whAction] = useActionState(updateDefaultWarehouse, null);
  const { successMsg: whSuccess, errorMsg: whError } = useActionFeedback(whState, t('settings.saved'));

  function handleTzChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setTz(e.target.value);
    setLocalSaved(true);
    setTimeout(() => setLocalSaved(false), 2000);
  }

  function handleCurrencyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setCurrency(e.target.value as Currency);
    setLocalSaved(true);
    setTimeout(() => setLocalSaved(false), 2000);
  }

  const selectedWarehouse = warehouses.find((w) => w.id === defaultWarehouseId);

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

        {warehouses.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              {t('settings.defaultWarehouse')}
            </label>
            <p className="text-xs text-slate-400 mb-2">{t('settings.defaultWarehouseDesc')}</p>
            <form action={whAction} className="flex gap-2">
              <select
                name="warehouse_id"
                defaultValue={defaultWarehouseId ?? ''}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">{t('settings.noWarehouse')}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <button type="submit"
                className="px-3 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium shrink-0">
                {t('incoming.saveButton')}
              </button>
            </form>
            {whError && <p className="text-red-600 text-xs mt-1">{whError}</p>}
            {whSuccess && <p className="text-green-600 text-xs mt-1">{whSuccess}</p>}
            {selectedWarehouse && !whSuccess && (
              <p className="text-xs text-slate-400 mt-1">現在: {selectedWarehouse.name}</p>
            )}
          </div>
        )}
      </div>

      {localSaved && (
        <p className="text-green-600 text-sm font-medium text-center">{t('settings.saved')}</p>
      )}
    </div>
  );
}
