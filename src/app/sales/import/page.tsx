import CsvImportForm from '@/components/CsvImportForm';
import Link from 'next/link';

export default function SalesImportPage() {
  return (
    <div>
      <div className="mb-4">
        <Link href="/sales" className="text-xs text-slate-400 hover:text-slate-600">← Back to Sales Entry</Link>
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">Import Sales CSV</h1>
      <p className="text-sm text-slate-500 mb-4">
        Upload a CSV file to bulk-import sales data. Existing entries for the same product/date will be overwritten.
      </p>

      <CsvImportForm />

      <div className="mt-6 bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs text-slate-500 space-y-2">
        <p className="font-semibold text-slate-600">Expected CSV format</p>
        <pre className="bg-white rounded border border-slate-200 p-3 overflow-x-auto">{`date,product_name,quantity
2026-04-17,Milk 1L,12
2026-04-17,Bread,8
2026-04-18,Milk 1L,10`}</pre>
        <ul className="space-y-1 list-disc list-inside">
          <li>Header row is optional</li>
          <li>Date format: YYYY-MM-DD</li>
          <li>Product name must match exactly (case-insensitive)</li>
          <li>Unknown products are skipped and reported</li>
        </ul>
      </div>
    </div>
  );
}
