'use client';

import { useActionState, useState } from 'react';
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
  sampleData?: string;
}

export default function MasterCsvImport({ action, formatHeader, formatExamples, sampleData }: Props) {
  const { t, tf } = useT();
  const [result, formAction, pending] = useActionState(action, null);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!sampleData) return;
    navigator.clipboard.writeText(sampleData).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mt-4">
      <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('master.importCsv')}</h2>
      <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600 font-mono">
        <p className="font-sans font-semibold text-slate-500 mb-1.5">{t('master.csvFormat')}</p>
        <p className="text-slate-400 break-all">{formatHeader}</p>
        {formatExamples.map((line, i) => <p key={i}>{line}</p>)}
      </div>
      {sampleData && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-slate-500">サンプルデータ</p>
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              {copied ? '✓ コピー完了' : 'コピー'}
            </button>
          </div>
          <pre className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 font-mono overflow-x-auto whitespace-pre-wrap break-all">{sampleData}</pre>
        </div>
      )}
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
