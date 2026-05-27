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
        sampleData={`名称,担当者名,電話番号,住所,備考
イオンリテール東京店,佐々木部長,03-2222-3333,東京都江東区有明3-1-1,毎週月曜納品
セブン-イレブン配送センター,高橋マネージャー,03-4444-5555,東京都足立区千住橋戸町50,365日受付
ライフコーポレーション大阪DC,松本さん,06-1111-2222,大阪府摂津市千里丘新町3-1,午前中のみ
マルエツ横浜店,岡田,045-777-8888,神奈川県横浜市港北区新横浜3-8-11,
コープこうべ物流センター,西田,078-333-4444,兵庫県神戸市東灘区魚崎浜町24,冷蔵対応可`}
      />
    </div>
  );
}
