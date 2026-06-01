'use client';

import { useActionState } from 'react';
import { importProductsCsv } from '@/lib/actions';
import { useT } from './LanguageProvider';

export default function ProductCsvImport() {
  const { t, tf } = useT();
  const [result, action, pending] = useActionState(importProductsCsv, null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('products.importCsv')}</h2>
      <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600 font-mono">
        <p className="font-sans font-semibold text-slate-500 mb-1.5">{t('products.csvFormat')}</p>
        <p className="text-slate-400">name,lead_time_days,safety_stock_days,price,pieces_per_ball,balls_per_case,cases_per_pallet</p>
        <p>牛乳1L,2,1,150</p>
        <p>食パン,1,2,200,12,6,4</p>
      </div>
      <form action={action} className="space-y-3">
        <textarea
          name="csv"
          rows={5}
          required
          placeholder={'name,lead_time_days,safety_stock_days\n牛乳1L,2,1\n食パン,1,2'}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
        />
        {result?.error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{result.error}</p>
        )}
        {result && !result.error && (
          <div className="text-sm space-y-1">
            <p className="text-green-700">{tf<string>('products.imported', result.imported)}</p>
            {result.skipped.length > 0 && (
              <details className="text-amber-600 text-xs">
                <summary className="cursor-pointer">{tf<string>('products.skipped', result.skipped.length)}</summary>
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
          {pending ? t('products.importing') : t('products.import')}
        </button>
      </form>
    </div>
  );
}
