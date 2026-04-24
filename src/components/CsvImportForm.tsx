'use client';

import { useActionState, useRef } from 'react';
import { importSalesCsv, type CsvImportResult } from '@/lib/actions';

export default function CsvImportForm() {
  const [result, action, pending] = useActionState<CsvImportResult | null, FormData>(
    importSalesCsv,
    null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">Import Sales CSV</h2>
      <p className="text-xs text-slate-400 mb-3">
        Format: <code className="bg-slate-100 px-1 rounded">date,product_name,quantity</code> (header row optional)
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
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {pending ? 'Importing...' : 'Import'}
        </button>
      </form>

      {result && (
        <div className="mt-3 space-y-1">
          {result.error ? (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{result.error}</p>
          ) : (
            <p className="text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2">
              Imported {result.imported} row{result.imported !== 1 ? 's' : ''}
            </p>
          )}
          {result.skipped.length > 0 && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer">{result.skipped.length} row{result.skipped.length !== 1 ? 's' : ''} skipped</summary>
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
