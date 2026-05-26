import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { addInventoryStatus, updateInventoryStatus, deleteInventoryStatus } from '@/lib/actions';
import MasterList, { type MasterRecord } from '@/components/MasterList';
import type { InventoryStatus } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function InventoryStatusesPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const { data } = await supabase.from('inventory_statuses').select('*').order('name');
  const items = (data ?? []) as unknown as MasterRecord[];

  const colorOptions = [
    { value: 'slate', label: t('inventoryStatus.colorSlate', lang) },
    { value: 'green', label: t('inventoryStatus.colorGreen', lang) },
    { value: 'amber', label: t('inventoryStatus.colorAmber', lang) },
    { value: 'red', label: t('inventoryStatus.colorRed', lang) },
    { value: 'blue', label: t('inventoryStatus.colorBlue', lang) },
    { value: 'purple', label: t('inventoryStatus.colorPurple', lang) },
  ];

  const fields = [
    { key: 'name', label: t('master.name', lang), required: true, placeholder: t('master.namePlaceholder', lang) },
    { key: 'color', label: t('master.color', lang), type: 'select' as const, options: colorOptions, required: true },
    { key: 'note', label: t('master.note', lang), type: 'textarea' as const, placeholder: t('master.note', lang) },
  ];

  const labels = {
    empty: t('inventoryStatus.empty', lang),
    addNew: t('master.addNew', lang),
    add: t('common.added', lang),
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
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('inventoryStatus.title', lang)}</h1>
      <MasterList
        items={items}
        fields={fields}
        addAction={addInventoryStatus}
        updateAction={updateInventoryStatus}
        deleteAction={deleteInventoryStatus}
        labels={labels}
      />
    </div>
  );
}
