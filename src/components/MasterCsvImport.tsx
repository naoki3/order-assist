'use client';

import { useActionState } from 'react';
import { useT } from './LanguageProvider';
import type { MasterCsvImportResult } from '@/lib/actions';

type MasterCsvAction = (
  prev: MasterCsvImportResult | null,
  formData: FormData
) => Promise<MasterCsvImportResult>;

interface Props {
  action: MasterCsvAction;
  formatHeader: string;
  formatExamples: string[];
}

export default function MasterCsvImport({ action, formatHeader, formatExamples }: Props) {
  const { t, tf } = useT();
  const [result, formAction, pending] = useActionState(action, null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mt-4">
      <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('master.importCsv')}</h2>
      <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600 font-mono">
        <p className="font-sans font-semibold text-slate-500 mb-1.5">{t('master.csvFormat')}</p>
        <p className="text-slate-400">{formatHeader}</p>
        {formatExamples.map((line, i) => <p key={i}>{line}</p>)}
      </div>
      <form action={formAction} className="space-y-3">
        <textarea
          name="csv"
          rows={5}
          required
          placeholder={formatHeader}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
        />
        {result?.error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{result.error}</p>
        )}
        {result && !result.error && (
          <div className="text-sm space-y-1">
            <p className="text-green-700">{tf<string>('master.imported', result.imported)}</p>
            {result.skipped.length > 0 && (
              <details className="text-amber-600 text-xs">
                <summary className="cursor-pointer">{tf<string>('master.skipped', result.skipped.length)}</summary>
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
          {pending ? t('master.importing') : t('master.import')}
        </button>
      </form>
    </div>
  );
}
