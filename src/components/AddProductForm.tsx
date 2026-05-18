'use client';

import { useActionState, useEffect, useState } from 'react';
import { addProduct } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';

export default function AddProductForm() {
  const { t } = useT();
  const [state, action] = useActionState(addProduct, null);
  const { successMsg, errorMsg } = useActionFeedback(state, t('common.added'));
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state && 'success' in state) {
      const timer = setTimeout(() => setFormKey((k) => k + 1), 0);
      return () => clearTimeout(timer);
    }
  }, [state]);

  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
      <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('products.addTitle')}</h2>
      <form key={formKey} action={action} className="space-y-3">
        <input
          type="text"
          name="name"
          required
          placeholder={t('products.namePlaceholder')}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1 text-slate-600">
            {t('products.leadTime')}
            <input
              type="number"
              name="lead_time_days"
              defaultValue={2}
              min={1}
              max={30}
              required
              className="w-14 border border-slate-300 rounded px-2 py-1 text-center"
            />
            {t('products.days')}
          </label>
          <label className="flex items-center gap-1 text-slate-600">
            {t('products.safetyStock')}
            <input
              type="number"
              name="safety_stock_days"
              defaultValue={1}
              min={1}
              max={14}
              required
              className="w-14 border border-slate-300 rounded px-2 py-1 text-center"
            />
            {t('products.days')}
          </label>
          <label className="flex items-center gap-1 text-slate-600">
            {t('products.unitPrice')}
            <input
              type="number"
              name="price"
              min={0}
              step="0.01"
              placeholder={t('products.optional')}
              className="w-24 border border-slate-300 rounded px-2 py-1 text-center"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1 text-slate-600">
            {t('products.shelfLife')}
            <select
              name="expiry_type"
              className="border border-slate-300 rounded px-2 py-1 text-sm"
            >
              <option value="">{t('products.expiryTypeNone')}</option>
              <option value="賞味期限">{t('products.expiryTypeBest')}</option>
              <option value="消費期限">{t('products.expiryTypeUse')}</option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-slate-600">
            {t('products.shelfLifeDays')}
            <input
              type="number"
              name="shelf_life_days"
              min={1}
              placeholder={t('products.optional')}
              className="w-20 border border-slate-300 rounded px-2 py-1 text-center"
            />
            {t('products.days')}
          </label>
        </div>
        {errorMsg && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
        )}
        {successMsg && (
          <p className="text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2">{successMsg}</p>
        )}
        <button
          type="submit"
          className="w-full py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium"
        >
          {t('products.addButton')}
        </button>
      </form>
    </div>
  );
}
