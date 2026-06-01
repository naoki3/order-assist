import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Lot } from '@/lib/db';
import StockTransferForm from '@/components/StockTransferForm';

export const dynamic = 'force-dynamic';

export default async function StockTransferPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: lotsData }, { data: locationsData }, { data: productsData }] = await Promise.all([
    supabase.from('lots').select('*').gt('quantity', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('lot_number', { ascending: true })
      .limit(2000),
    supabase.from('locations').select('id, name, warehouse_id').order('name').limit(1000),
    supabase.from('products').select('id, name, pieces_per_ball, balls_per_case, cases_per_pallet').order('id').limit(1000),
  ]);

  const lots = (lotsData ?? []) as Lot[];
  const locations = (locationsData ?? []) as { id: number; name: string; warehouse_id: number | null }[];
  const products = (productsData ?? []) as { id: number; name: string; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('transfer.title', lang)}</h1>
        <p className="text-sm text-slate-500">{t('transfer.subtitle', lang)}</p>
      </div>

      <StockTransferForm lots={lots} locations={locations} products={products} />
    </div>
  );
}
