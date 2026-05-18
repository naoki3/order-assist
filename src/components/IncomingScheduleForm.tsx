'use client';

import { useActionState } from 'react';
import { addIncomingSchedule } from '@/lib/actions';
import { useT } from './LanguageProvider';

interface Props {
  products: { id: number; name: string }[];
  today: string;
}

export default function IncomingScheduleForm({ products, today }: Props) {
  const { t } = useT();
  const [state, action] = useActionState(addIncomingSchedule, null);

  return (
    <form action={action} className="space-y-3">
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
      {state?.error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
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
