'use client';

import { useActionState } from 'react';
import { deleteOutgoingSchedule } from '@/lib/actions';
import { useT } from './LanguageProvider';

export default function DeleteOutgoingButton({ id }: { id: number }) {
  const { t } = useT();
  const [state, action] = useActionState(deleteOutgoingSchedule, null);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="px-3 py-1.5 text-red-500 text-sm rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
        >
          {t('shipping.delete')}
        </button>
      </form>
      {state?.error && (
        <p className="text-red-600 text-xs text-right">{state.error}</p>
      )}
    </div>
  );
}
