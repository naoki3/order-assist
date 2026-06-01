import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { addCarrier, updateCarrier, deleteCarrier, importCarriersCsv } from '@/lib/actions';
import MasterList, { type MasterRecord } from '@/components/MasterList';
import MasterCsvImport from '@/components/MasterCsvImport';

export const dynamic = 'force-dynamic';

export default async function CarriersPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const { data } = await supabase.from('carriers').select('*').order('name').limit(500);
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
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('carrier.title', lang)}</h1>
      <MasterList
        items={items}
        fields={fields}
        addAction={addCarrier}
        updateAction={updateCarrier}
        deleteAction={deleteCarrier}
        labels={labels}
      />
      <MasterCsvImport
        action={importCarriersCsv}
        formatHeader="name,contact_name,phone,note"
        formatExamples={['ヤマト運輸,山田,0120-01-1234,配送頻度:毎日']}
        sampleData={`名称,担当者名,電話番号,備考
ヤマト運輸,担当:法人窓口,0120-01-9625,クール便対応可
佐川急便,担当:法人担当,0120-36-9820,大型荷物対応
日本通運,鈴木担当,0120-333-070,チャーター便あり
西濃運輸,,0120-912-925,パレット輸送専門
福山通運,中村,0120-15-8090,`}
      />
    </div>
  );
}
