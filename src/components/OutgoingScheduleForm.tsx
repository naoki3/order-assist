'use client';

import { useActionState } from 'react';
import { addOutgoingSchedule } from '@/lib/actions';
import { useT } from './LanguageProvider';

interface Props {
  products: { id: number; name: string }[];
  today: string;
}

export default function OutgoingScheduleForm({ products, today }: Props) {
  const { t } = useT();
  const [state, action] = useActionState(addOutgoingSchedule, null);

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <select
          name="product_id"
          required
          className="flex-1 min-w-40 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('shipping.selectProduct')}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="number"
          name="quantity"
          min={1}
          required
          placeholder={t('shipping.quantityPlaceholder')}
          className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          name="scheduled_date"
          defaultValue={today}
          required
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <input
        type="text"
        name="note"
        placeholder={t('shipping.notePlaceholder')}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {state?.error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
      )}
      <button
        type="submit"
        className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        {t('shipping.addButton')}
      </button>
    </form>
  );
}
