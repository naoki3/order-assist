import { createClient } from '@/lib/supabase';
import { getLang, getTz } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { OrderHistoryItem } from '@/lib/db';
import type { UnitConfig } from '@/lib/units';
import OrderHistoryList from '@/components/OrderHistoryList';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const [supabase, lang, tz] = await Promise.all([createClient(), getLang(), getTz()]);
  const [{ data }, { data: productsData }] = await Promise.all([
    supabase.from('order_history').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet'),
  ]);
  const orders = (data ?? []) as OrderHistoryItem[];
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    ((productsData ?? []) as { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null }[])
      .map((p) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4 print:hidden">{t('history.title', lang)}</h1>
      <OrderHistoryList orders={orders} unitMap={unitMap} tz={tz} />
    </div>
  );
}
