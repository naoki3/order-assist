import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { addSupplier, updateSupplier, deleteSupplier, importSuppliersCsv } from '@/lib/actions';
import MasterList, { type MasterRecord } from '@/components/MasterList';
import MasterCsvImport from '@/components/MasterCsvImport';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const { data } = await supabase.from('suppliers').select('*').order('name');
  const items = (data ?? []) as unknown as MasterRecord[];

  const fields = [
    { key: 'name', label: t('master.name', lang), required: true, placeholder: t('master.namePlaceholder', lang) },
    { key: 'contact_name', label: t('master.contactName', lang), placeholder: t('master.contactName', lang) },
    { key: 'phone', label: t('master.phone', lang), type: 'tel' as const, placeholder: t('master.phone', lang) },
    { key: 'email', label: t('master.email', lang), type: 'email' as const, placeholder: t('master.email', lang) },
    { key: 'address', label: t('master.address', lang), placeholder: t('master.address', lang) },
    { key: 'note', label: t('master.note', lang), type: 'textarea' as const, placeholder: t('master.note', lang) },
  ];

  const labels = {
    empty: t('supplier.empty', lang),
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
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('supplier.title', lang)}</h1>
      <MasterList
        items={items}
        fields={fields}
        addAction={addSupplier}
        updateAction={updateSupplier}
        deleteAction={deleteSupplier}
        labels={labels}
      />
      <MasterCsvImport
        action={importSuppliersCsv}
        formatHeader="name,contact_name,phone,email,address,note"
        formatExamples={['株式会社A,田中,03-1234-5678,info@a.co,東京都〇〇,備考']}
        sampleData={`名称,担当者名,電話番号,メールアドレス,住所,備考
山田食品株式会社,山田太郎,03-1234-5678,yamada@yamada-food.co.jp,東京都中央区築地5-2-1,鮮魚・加工食品専門
鈴木農産,鈴木一郎,0120-111-222,suzuki@suzuki-nosan.jp,千葉県成田市加良部1-1,野菜・果物
田中商事株式会社,田中花子,06-9876-5432,tanaka@tanaka-shoji.co.jp,大阪府大阪市中央区本町2-3-4,冷凍食品・乾物
北海道物産,佐藤健,011-333-4444,sato@hokkaido-bussan.jp,北海道札幌市中央区北5条西6丁目,乳製品・海産物
九州フレッシュ,中村誠,092-555-6666,,福岡県福岡市博多区博多駅前3-2-1,`}
      />
    </div>
  );
}
