import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { ReceiptWithLines } from '@/lib/db';
import IncomingScheduleList from '@/components/IncomingScheduleList';
import IncomingCsvImport from '@/components/IncomingCsvImport';
import { cookies } from 'next/headers';
import { toLocalDateStr, DEFAULT_TZ } from '@/lib/tz';

export const dynamic = 'force-dynamic';

export default async function IncomingSchedulePage() {
  const [supabase, lang, cookieStore] = await Promise.all([createClient(), getLang(), cookies()]);
  const today = toLocalDateStr(cookieStore.get('tz')?.value ?? DEFAULT_TZ);
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: pendingData }, { data: productsData }, { data: inventoryData }, { data: suppliersData }, { data: warehousesData }, { data: profileData }] = await Promise.all([
    supabase
      .from('receipts')
      .select('*, receipt_lines(*)')
      .eq('status', 'expected')
      .order('expected_date', { ascending: true })
      .order('id'),
    supabase.from('products').select('id, name, pieces_per_ball, balls_per_case, cases_per_pallet, expiry_type, default_warehouse_id').order('id'),
    supabase.from('inventory').select('product_id, current_stock'),
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('warehouses').select('id, name').order('name'),
    user
      ? supabase.from('user_profiles').select('warehouse_id').eq('auth_user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const receipts = (pendingData ?? []) as ReceiptWithLines[];
  const stockMap = Object.fromEntries((inventoryData ?? []).map((i) => [i.product_id, i.current_stock]));
  const products = ((productsData ?? []) as { id: number; name: string; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null; expiry_type: string | null; default_warehouse_id: number | null }[]).filter((p) => (stockMap[p.id] ?? 0) > 0);
  const suppliers = (suppliersData ?? []) as { id: number; name: string }[];
  const warehouses = (warehousesData ?? []) as { id: number; name: string }[];
  const defaultWarehouseId = (profileData as { warehouse_id: number | null } | null)?.warehouse_id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('incoming.scheduleTitle', lang)}</h1>
        <p className="text-sm text-slate-500">{t('incoming.scheduleSubtitle', lang)}</p>
      </div>

      <IncomingScheduleList receipts={receipts} emptyText={t('incoming.noScheduled', lang)} products={products} suppliers={suppliers} warehouses={warehouses} today={today} defaultWarehouseId={defaultWarehouseId} />

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('incoming.importCsv', lang)}</h2>
        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600 font-mono">
          <p className="font-sans font-semibold text-slate-500 mb-1.5">{t('incoming.csvFormat', lang)}</p>
          <p className="text-slate-400">入荷予定日,伝票番号,商品名,数量[,ロット番号][,賞味期限][,仕入先名][,倉庫名]</p>
          <p>2026-05-20,RCV-20260520-ABC123,牛乳1L,10</p>
          <p>2026-05-20,RCV-20260520-ABC123,食パン,5,L001,2026-12-31</p>
          <p>2026-05-21,,卵（10個入）,20,,,ABC仕入先,東京倉庫</p>
        </div>
        <div className="text-xs text-slate-400 space-y-0.5 mb-4">
          <p>· {t('incoming.csvHint1', lang)}</p>
          <p>· {t('incoming.csvHint2', lang)}</p>
          <p>· {t('incoming.csvHint3', lang)}</p>
          <p>· {t('incoming.csvHint4', lang)}</p>
          <p>· {t('incoming.csvHint5', lang)}</p>
        </div>
        <IncomingCsvImport />
      </div>
    </div>
  );
}
