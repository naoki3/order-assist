'use client';

import { useActionState } from 'react';
import { importOutgoingCsv } from '@/lib/actions';
import { useT, useT as useTAlias } from './LanguageProvider';

export default function OutgoingCsvImport() {
  const { t, tf } = useT();
  const [result, action, pending] = useActionState(importOutgoingCsv, null);

  return (
    <form action={action} className="space-y-3">
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
      />
      {result?.error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{result.error}</p>
      )}
      {result && !result.error && (
        <div className="text-sm space-y-1">
          <p className="text-green-700">{tf<string>('shipping.imported', result.imported)}</p>
          {result.skipped.length > 0 && (
            <p className="text-amber-600">
              {tf<string>('shipping.skipped', result.skipped.length)}：{result.skipped.slice(0, 3).join(', ')}{result.skipped.length > 3 ? '…' : ''}
            </p>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
      >
        {pending ? t('shipping.importing') : t('shipping.import')}
      </button>
    </form>
  );
}
