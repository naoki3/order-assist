import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import CsvImportForm from '@/components/CsvImportForm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SalesImportPage() {
  const lang = await getLang();

  return (
    <div>
      <div className="mb-4">
        <Link href="/sales" className="text-xs text-slate-400 hover:text-slate-600">{t('import.back', lang)}</Link>
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">{t('import.title', lang)}</h1>
      <p className="text-sm text-slate-500 mb-4">{t('import.subtitle', lang)}</p>

      <CsvImportForm />

      <div className="mt-6 bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs text-slate-500 space-y-2">
        <p className="font-semibold text-slate-600">{t('import.formatTitle', lang)}</p>
        <pre className="bg-white rounded border border-slate-200 p-3 overflow-x-auto">{`date,product_name,quantity
2026-04-17,Milk 1L,12
2026-04-17,Bread,8
2026-04-18,Milk 1L,10`}</pre>
        <ul className="space-y-1 list-disc list-inside">
          <li>{t('import.hint1', lang)}</li>
          <li>{t('import.hint2', lang)}</li>
          <li>{t('import.hint3', lang)}</li>
          <li>{t('import.hint4', lang)}</li>
        </ul>
      </div>
    </div>
  );
}
