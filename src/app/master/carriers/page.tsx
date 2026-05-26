import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { addCarrier, updateCarrier, deleteCarrier } from '@/lib/actions';
import MasterList, { type MasterRecord } from '@/components/MasterList';

export const dynamic = 'force-dynamic';

export default async function CarriersPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const { data } = await supabase.from('carriers').select('*').order('name');
  const items = (data ?? []) as unknown as MasterRecord[];

  const fields = [
    { key: 'name', label: t('master.name', lang), required: true, placeholder: t('master.namePlaceholder', lang) },
    { key: 'contact_name', label: t('master.contactName', lang), placeholder: t('master.contactName', lang) },
    { key: 'phone', label: t('master.phone', lang), type: 'tel' as const, placeholder: t('master.phone', lang) },
    { key: 'note', label: t('master.note', lang), type: 'textarea' as const, placeholder: t('master.note', lang) },
  ];

  const labels = {
    empty: t('carrier.empty', lang),
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
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('carrier.title', lang)}</h1>
      <MasterList
        items={items}
        fields={fields}
        addAction={addCarrier}
        updateAction={updateCarrier}
        deleteAction={deleteCarrier}
        labels={labels}
      />
    </div>
  );
}
