import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { addWarehouse, updateWarehouse, deleteWarehouse, importWarehousesCsv } from '@/lib/actions';
import MasterList, { type MasterRecord } from '@/components/MasterList';
import MasterCsvImport from '@/components/MasterCsvImport';

export const dynamic = 'force-dynamic';

export default async function WarehousesPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const { data } = await supabase.from('warehouses').select('*').order('name');
  const items = (data ?? []) as unknown as MasterRecord[];

  const fields = [
    { key: 'name', label: t('master.name', lang), required: true, placeholder: t('master.namePlaceholder', lang) },
    { key: 'address', label: t('master.address', lang), placeholder: t('master.address', lang) },
    { key: 'note', label: t('master.note', lang), type: 'textarea' as const, placeholder: t('master.note', lang) },
  ];

  const labels = {
    empty: t('warehouse.empty', lang),
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
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('warehouse.title', lang)}</h1>
      <MasterList
        items={items}
        fields={fields}
        addAction={addWarehouse}
        updateAction={updateWarehouse}
        deleteAction={deleteWarehouse}
        labels={labels}
      />
      <MasterCsvImport
        action={importWarehousesCsv}
        formatHeader="name,address,note"
        formatExamples={['東京倉庫,東京都江東区〇〇1-1,メイン倉庫', '大阪倉庫,大阪府大阪市〇〇2-2,']}
      />
    </div>
  );
}
