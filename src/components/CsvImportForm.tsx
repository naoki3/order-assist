'use client';

import { useActionState, useRef } from 'react';
import { importSalesCsv, type CsvImportResult } from '@/lib/actions';
import { useT } from './LanguageProvider';

export default function CsvImportForm() {
  const { t, tf } = useT();
  const [result, action, pending] = useActionState<CsvImportResult | null, FormData>(
    importSalesCsv,
    null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">{t('import.csvTitle')}</h2>
      <p className="text-xs text-slate-400 mb-3">
        {t('import.formatLabel')}<code className="bg-slate-100 px-1 rounded">date,product_name,quantity</code>{t('import.formatSuffix')}
      </p>

      <form action={action} className="space-y-3">
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-1.5 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
        >
          {pending ? t('import.importing') : t('import.import')}
        </button>
      </form>

      {result && (
        <div className="mt-3 space-y-1">
          {result.error ? (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{result.error}</p>
          ) : (
            <p className="text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2">
              {tf<string>('import.imported', result.imported)}
            </p>
          )}
          {result.skipped.length > 0 && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer">{tf<string>('import.skipped', result.skipped.length)}</summary>
              <ul className="mt-1 space-y-0.5 pl-2">
                {result.skipped.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
