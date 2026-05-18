'use client';

import { useActionState, useEffect, useState } from 'react';
import { addIncomingSchedule } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';

interface Props {
  products: { id: number; name: string }[];
  today: string;
}

export default function IncomingScheduleForm({ products, today }: Props) {
  const { t } = useT();
  const [state, action] = useActionState(addIncomingSchedule, null);
  const { successMsg, errorMsg } = useActionFeedback(state, t('common.added'));
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state && 'success' in state) {
      const timer = setTimeout(() => setFormKey((k) => k + 1), 0);
      return () => clearTimeout(timer);
    }
  }, [state]);

  return (
    <form key={formKey} action={action} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <select
          name="product_id"
          required
          className="flex-1 min-w-40 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">{t('incoming.selectProduct')}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="number"
          name="quantity"
          min={1}
          required
          placeholder={t('incoming.quantityPlaceholder')}
          className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <input
          type="date"
          name="expected_date"
          defaultValue={today}
          required
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
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
        {t('incoming.addButton')}
      </button>
    </form>
  );
}
