'use client';

import { useActionState } from 'react';
import { importIncomingCsv } from '@/lib/actions';
import { useT } from './LanguageProvider';

export default function IncomingCsvImport() {
  const { t, tf } = useT();
  const [result, action, pending] = useActionState(importIncomingCsv, null);

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
          <p className="text-green-700">{tf<string>('incoming.imported', result.imported)}</p>
          {result.skipped.length > 0 && (
            <details className="text-amber-600 text-xs">
              <summary className="cursor-pointer">{tf<string>('incoming.skipped', result.skipped.length)}</summary>
              <ul className="mt-1 space-y-0.5 pl-2">
                {result.skipped.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors font-medium disabled:opacity-50"
      >
        {pending ? t('incoming.importing') : t('incoming.import')}
      </button>
    </form>
  );
}
