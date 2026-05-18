'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateLotProperties } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import type { Lot } from '@/lib/db';

function LotCorrectionRow({ lot }: { lot: Lot }) {
  const { t } = useT();
  const [state, action] = useActionState(updateLotProperties, null);
  const { successMsg, errorMsg } = useActionFeedback(state, t('common.saved'));
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state && 'success' in state) {
      const timer = setTimeout(() => setFormKey((k) => k + 1), 0);
      return () => clearTimeout(timer);
    }
  }, [state]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-slate-800">{lot.product_name}</p>
        <span className="text-sm text-slate-500">{t('inventory.currentStockLabel')}: {lot.quantity} {t('inventory.units')}</span>
      </div>
      <form key={formKey} action={action} className="space-y-2">
        <input type="hidden" name="lot_id" value={lot.id} />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-1 py-0.5 rounded tracking-wide shrink-0">LOT</span>
          <input
            type="text"
            name="lot_number"
            required
            defaultValue={lot.lot_number}
            placeholder={t('inventory.correctionLotNumber')}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <input
          type="date"
          name="expiry_date"
          defaultValue={lot.expiry_date ?? ''}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium"
          >
            {t('inventory.correctionSave')}
          </button>
        </div>
      </form>
      {errorMsg && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mt-2">{errorMsg}</p>}
      {successMsg && <p className="text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2 mt-2">{successMsg}</p>}
    </div>
  );
}

export default function LotCorrectionForm({ lots }: { lots: Lot[] }) {
  return (
    <div className="space-y-3">
      {lots.map((lot) => <LotCorrectionRow key={lot.id} lot={lot} />)}
    </div>
  );
}
