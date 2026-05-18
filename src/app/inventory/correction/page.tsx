import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Lot } from '@/lib/db';
import LotCorrectionForm from '@/components/LotCorrectionForm';

export const dynamic = 'force-dynamic';

export default async function InventoryCorrectionPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const { data: lotsData } = await supabase
    .from('lots')
    .select('*')
    .order('product_id')
    .order('received_at', { ascending: false });
  const lots = (lotsData ?? []) as Lot[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('inventory.correctionTitle', lang)}</h1>
        <p className="text-sm text-slate-500">{t('inventory.correctionSubtitle', lang)}</p>
      </div>

      {lots.length === 0 ? (
        <p className="text-slate-400 text-sm">{t('inventory.correctionNoLots', lang)}</p>
      ) : (
        <LotCorrectionForm lots={lots} />
      )}
    </div>
  );
}
