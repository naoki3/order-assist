import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Lot } from '@/lib/db';
import CycleCountClient from '@/components/CycleCountClient';

export const dynamic = 'force-dynamic';

export default async function CycleCountPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);

  const { data } = await supabase
    .from('lots')
    .select('*')
    .gt('quantity', 0)
    .order('product_name', { ascending: true })
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .order('received_at', { ascending: false });

  const lots = (data ?? []) as Lot[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('cycleCount.title', lang)}</h1>
        <p className="text-sm text-slate-500">{t('cycleCount.subtitle', lang)}</p>
      </div>
      <CycleCountClient lots={lots} />
    </div>
  );
}
