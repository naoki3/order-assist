import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Lot } from '@/lib/db';
import type { UnitConfig } from '@/lib/units';
import CycleCountClient from '@/components/CycleCountClient';

export const dynamic = 'force-dynamic';

export default async function CycleCountPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);

  const [{ data: lotsData }, { data: productsData }, { data: warehousesData }] = await Promise.all([
    supabase
      .from('lots')
      .select('*')
      .gt('quantity', 0)
      .order('product_name', { ascending: true })
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('received_at', { ascending: false })
      .limit(2000),
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet').limit(1000),
    supabase.from('warehouses').select('id, name').order('name').limit(500),
  ]);

  const lots = (lotsData ?? []) as Lot[];
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    ((productsData ?? []) as { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null }[])
      .map((p) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );
  const warehouses = (warehousesData ?? []) as { id: number; name: string }[];

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('cycleCount.title', lang)}</h1>
        <p className="text-sm text-slate-500">{t('cycleCount.subtitle', lang)}</p>
      </div>
      <CycleCountClient lots={lots} unitMap={unitMap} warehouses={warehouses} />
    </div>
  );
}
