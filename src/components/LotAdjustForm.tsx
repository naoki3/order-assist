'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateLotQuantity } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import type { Lot } from '@/lib/db';

function LotRow({ lot }: { lot: Lot }) {
  const { t } = useT();
  const [state, action] = useActionState(updateLotQuantity, null);
  const { successMsg, errorMsg } = useActionFeedback(state, t('common.updated'));
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state && 'success' in state) {
      const timer = setTimeout(() => setFormKey((k) => k + 1), 0);
      return () => clearTimeout(timer);
    }
  }, [state]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-800">{lot.product_name}</p>
          <p className="text-xs font-mono text-slate-500 mt-0.5">{lot.lot_number}</p>
          {lot.expiry_date && (
            <p className="text-xs text-slate-400 mt-0.5">{t('inventory.lotExpiry')}: {lot.expiry_date}</p>
          )}
        </div>
        <span className="text-sm font-medium text-slate-600">
          {t('inventory.currentStockLabel')}: {lot.quantity}
        </span>
      </div>
      <form key={formKey} action={action} className="flex items-center gap-2">
        <input type="hidden" name="lot_id" value={lot.id} />
        <input
          type="number"
          name="quantity"
          min={0}
          required
          placeholder={t('inventory.newStockPlaceholder')}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <span className="text-sm text-slate-500 shrink-0">{t('inventory.units')}</span>
        <button
          type="submit"
          className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium shrink-0"
        >
          {t('inventory.adjustButton')}
        </button>
      </form>
      {errorMsg && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mt-2">{errorMsg}</p>}
      {successMsg && <p className="text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2 mt-2">{successMsg}</p>}
    </div>
  );
}

export default function LotAdjustForm({ lots }: { lots: Lot[] }) {
  return (
    <div className="space-y-3">
      {lots.map((lot) => <LotRow key={lot.id} lot={lot} />)}
    </div>
  );
}
