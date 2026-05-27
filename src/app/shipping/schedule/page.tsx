import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { OutgoingStock, Lot } from '@/lib/db';
import OutgoingCsvImport from '@/components/OutgoingCsvImport';
import OutgoingScheduleList from '@/components/OutgoingScheduleList';
import { cookies } from 'next/headers';
import { toLocalDateStr, DEFAULT_TZ } from '@/lib/tz';

export const dynamic = 'force-dynamic';

export default async function ShippingSchedulePage() {
  const [supabase, lang, cookieStore] = await Promise.all([createClient(), getLang(), cookies()]);
  const today = toLocalDateStr(cookieStore.get('tz')?.value ?? DEFAULT_TZ);
  const [{ data: pendingData }, { data: productsData }, { data: lotsData }, { data: inventoryData }, { data: destinationsData }, { data: carriersData }, { data: locationsData }] = await Promise.all([
    supabase
      .from('outgoing_stock')
      .select('*')
      .is('shipped_at', null)
      .order('scheduled_date', { ascending: false })
      .order('id'),
    supabase.from('products').select('id, name, pieces_per_ball, balls_per_case, cases_per_pallet, default_warehouse_id').order('id'),
    supabase.from('lots').select('*').gt('quantity', 0).order('expiry_date', { ascending: true, nullsFirst: false }),
    supabase.from('inventory').select('product_id, current_stock'),
    supabase.from('delivery_destinations').select('id, name').order('name'),
    supabase.from('carriers').select('id, name').order('name'),
    supabase.from('locations').select('id, name, warehouse_id').order('name'),
  ]);
  const pending = (pendingData ?? []) as OutgoingStock[];
  const stockMap = Object.fromEntries((inventoryData ?? []).map((i) => [i.product_id, i.current_stock]));
  const products = ((productsData ?? []) as { id: number; name: string; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null; default_warehouse_id: number | null }[]).filter((p) => (stockMap[p.id] ?? 0) > 0);
  const lots = (lotsData ?? []) as Lot[];
  const destinations = (destinationsData ?? []) as { id: number; name: string }[];
  const carriers = (carriersData ?? []) as { id: number; name: string }[];
  const locations = (locationsData ?? []) as { id: number; name: string; warehouse_id: number | null }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('shipping.scheduleTitle', lang)}</h1>
        <p className="text-sm text-slate-500">{t('shipping.scheduleSubtitle', lang)}</p>
      </div>

      <OutgoingScheduleList items={pending} emptyText={t('shipping.noScheduled', lang)} products={products} lots={lots} destinations={destinations} carriers={carriers} locations={locations} today={today} />

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('shipping.importCsv', lang)}</h2>
        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600 font-mono">
          <p className="font-sans font-semibold text-slate-500 mb-1.5">{t('shipping.csvFormat', lang)}</p>
          <p className="text-slate-400">出荷予定日,商品名,数量[,ロット番号][,賞味期限][,備考]</p>
          <p>2026-05-20,牛乳1L,10,L001,2026-12-31,A店向け</p>
          <p>2026-05-20,食パン,5</p>
          <p>2026-05-21,卵（10個入）,20,,,B店向け</p>
        </div>
        <div className="text-xs text-slate-400 space-y-0.5 mb-4">
          <p>· {t('shipping.csvHint1', lang)}</p>
          <p>· {t('shipping.csvHint2', lang)}</p>
          <p>· {t('shipping.csvHint3', lang)}</p>
          <p>· {t('shipping.csvHint4', lang)}</p>
          <p>· {t('shipping.csvHint5', lang)}</p>
        </div>
        <OutgoingCsvImport />
      </div>
    </div>
  );
}
