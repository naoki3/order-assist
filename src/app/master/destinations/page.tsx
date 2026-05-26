import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { addDeliveryDestination, updateDeliveryDestination, deleteDeliveryDestination, importDestinationsCsv } from '@/lib/actions';
import MasterList, { type MasterRecord } from '@/components/MasterList';
import MasterCsvImport from '@/components/MasterCsvImport';

export const dynamic = 'force-dynamic';

export default async function DestinationsPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const { data } = await supabase.from('delivery_destinations').select('*').order('name');
  const items = (data ?? []) as unknown as MasterRecord[];

  const fields = [
    { key: 'name', label: t('master.name', lang), required: true, placeholder: t('master.namePlaceholder', lang) },
    { key: 'contact_name', label: t('master.contactName', lang), placeholder: t('master.contactName', lang) },
    { key: 'phone', label: t('master.phone', lang), type: 'tel' as const, placeholder: t('master.phone', lang) },
    { key: 'address', label: t('master.address', lang), placeholder: t('master.address', lang) },
    { key: 'note', label: t('master.note', lang), type: 'textarea' as const, placeholder: t('master.note', lang) },
  ];

  const labels = {
    empty: t('destination.empty', lang),
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
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('destination.title', lang)}</h1>
      <MasterList
        items={items}
        fields={fields}
        addAction={addDeliveryDestination}
        updateAction={updateDeliveryDestination}
        deleteAction={deleteDeliveryDestination}
        labels={labels}
      />
      <MasterCsvImport
        action={importDestinationsCsv}
        formatHeader="name,contact_name,phone,address,note"
        formatExamples={['B店,鈴木,06-1234-5678,大阪府〇〇,備考']}
      />
    </div>
  );
}
