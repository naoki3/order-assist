import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { addLocation, updateLocation, deleteLocation, importLocationsCsv } from '@/lib/actions';
import MasterList, { type MasterRecord } from '@/components/MasterList';
import MasterCsvImport from '@/components/MasterCsvImport';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: locationsData }, { data: warehousesData }] = await Promise.all([
    supabase
      .from('locations')
      .select('id, name, warehouse_id, note')
      .order('warehouse_id')
      .order('name')
      .limit(1000),
    supabase.from('warehouses').select('id, name').order('name').limit(500),
  ]);

  const warehouses = (warehousesData ?? []) as { id: number; name: string }[];
  const warehouseOptions = warehouses.map((w) => ({ value: String(w.id), label: w.name }));
  const items = (locationsData ?? []) as unknown as MasterRecord[];

  const fields = [
    { key: 'name', label: t('master.name', lang), required: true, placeholder: t('master.namePlaceholder', lang) },
    { key: 'warehouse_id', label: t('location.warehouse', lang), type: 'select' as const, options: warehouseOptions, required: true },
    { key: 'note', label: t('master.note', lang), type: 'textarea' as const, placeholder: t('master.note', lang) },
  ];

  const labels = {
    empty: t('location.empty', lang),
    addNew: t('master.addNew', lang),
    add: t('master.add', lang),
    adding: t('master.adding', lang),
    save: t('products.save', lang),
    saving: t('master.saving', lang),
    cancel: t('common.cancel', lang),
    delete: t('products.delete', lang),
    confirmDelete: t('common.confirmQuestion', lang),
    edit: t('master.edit', lang),
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('location.title', lang)}</h1>
      {warehouses.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          {t('location.noWarehouses', lang)}{' '}
          <Link href="/master/warehouses" className="underline font-medium">
            {t('warehouse.title', lang)}
          </Link>
        </div>
      ) : (
        <>
          <MasterList
            items={items}
            fields={fields}
            addAction={addLocation}
            updateAction={updateLocation}
            deleteAction={deleteLocation}
            labels={labels}
          />
          <MasterCsvImport
            action={importLocationsCsv}
            formatHeader="name,warehouse_name,note"
            formatExamples={['A-1-1,東京倉庫,冷蔵エリア', 'B-2-3,大阪倉庫,']}
            sampleData={`名称,倉庫名,備考
A-01,東京倉庫,常温ゾーン
A-02,東京倉庫,常温ゾーン
A-03,東京倉庫,常温ゾーン
B-01,東京倉庫,冷蔵ゾーン
B-02,東京倉庫,冷蔵ゾーン
C-01,東京倉庫,冷凍ゾーン
A-01,大阪倉庫,
A-02,大阪倉庫,
B-01,大阪倉庫,
A-01,名古屋倉庫,
A-02,名古屋倉庫,`}
          />
        </>
      )}
    </div>
  );
}
