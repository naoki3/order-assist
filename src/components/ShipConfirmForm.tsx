'use client';

import { useActionState } from 'react';
import { confirmShipment } from '@/lib/actions';
import { useT } from './LanguageProvider';

export default function ShipConfirmForm({ id }: { id: number }) {
  const { t } = useT();
  const [state, action] = useActionState(confirmShipment, null);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          {t('shipping.confirm')}
        </button>
      </form>
      {state?.error && (
        <p className="text-red-600 text-xs text-right">{state.error}</p>
      )}
    </div>
  );
}
