'use client';

import { useActionState } from 'react';
import { setMonthlyTarget } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';

interface Props {
  month: string;
  currentTarget: number | null;
}

export default function TargetForm({ month, currentTarget }: Props) {
  const { t } = useT();
  const [state, action, pending] = useActionState(setMonthlyTarget, null);
  const { successMsg, errorMsg } = useActionFeedback(state, t('common.saved'));

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="month" value={month} />
      <span className="text-sm text-slate-500 shrink-0">{t('target.label')}</span>
      <input
        type="number"
        name="target_amount"
        defaultValue={currentTarget ?? ''}
        min={0}
        step="1"
        placeholder="0"
        className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="px-3 py-1.5 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
      >
        {pending ? t('target.saving') : t('target.save')}
      </button>
      {errorMsg && <span className="text-xs text-red-600">{errorMsg}</span>}
      {successMsg && <span className="text-xs text-green-600">{successMsg}</span>}
    </form>
  );
}
