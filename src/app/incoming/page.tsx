import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { translations } from '@/lib/i18n';
import IncomingConfirmList from '@/components/IncomingConfirmList';
import ReceivedHistoryList from '@/components/ReceivedHistoryList';
import type { ReceiptWithLines } from '@/lib/db';
import type { UnitConfig } from '@/lib/units';
import { cookies } from 'next/headers';
import { toLocalDateStr, DEFAULT_TZ } from '@/lib/tz';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function IncomingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(0, parseInt(pageParam ?? '0', 10) || 0);
  const [supabase, lang, cookieStore] = await Promise.all([createClient(), getLang(), cookies()]);
  const dict = translations[lang];
  const today = toLocalDateStr(cookieStore.get('tz')?.value ?? DEFAULT_TZ);

  const [{ data: pendingData }, { data: receivedData, count: receivedCount }, { data: productsData }, { data: locationsData }, { data: statusesData }] = await Promise.all([
    supabase.from('receipts')
      .select('*, receipt_lines(*)')
      .eq('status', 'expected')
      .order('expected_date', { ascending: true })
      .order('id'),
    supabase.from('receipts')
      .select('*, receipt_lines(*)', { count: 'exact' })
      .eq('status', 'received')
      .order('received_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet, expiry_type'),
    supabase.from('locations').select('id, name, warehouse_id').order('name'),
    supabase.from('inventory_statuses').select('id, name, color').order('name'),
  ]);

  const pending = (pendingData ?? []) as ReceiptWithLines[];
  const received = (receivedData ?? []) as ReceiptWithLines[];
  const totalReceived = receivedCount ?? 0;
  const totalPages = Math.ceil(totalReceived / PAGE_SIZE);

  type ProductRow = { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null; expiry_type: string | null };
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    (productsData ?? []).map((p: ProductRow) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );
  const expiryTypeMap: Record<number, string | null> = Object.fromEntries(
    (productsData ?? []).map((p: ProductRow) => [p.id, p.expiry_type ?? null])
  );
  const locations = (locationsData ?? []) as { id: number; name: string; warehouse_id: number | null }[];
  const statuses = (statusesData ?? []) as { id: number; name: string; color: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{dict['incoming.title']}</h1>
        <p className="text-sm text-slate-500">{dict['incoming.subtitle']}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">{dict['incoming.awaiting']}</h2>
        <IncomingConfirmList receipts={pending} emptyText={dict['incoming.noAwaiting'] as string} unitMap={unitMap} expiryTypeMap={expiryTypeMap} today={today} locations={locations} statuses={statuses} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-600">{dict['incoming.receivedLabel']}</h2>
          <p className="text-xs text-slate-400">
            {`全 ${totalReceived} 件`}
            {totalPages > 1 && <span className="ml-2">{`${page + 1} / ${totalPages} ページ`}</span>}
          </p>
        </div>
        <ReceivedHistoryList receipts={received} emptyText={dict['incoming.noAwaiting'] as string} unitMap={unitMap} />
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            {page > 0 ? (
              <a href={page - 1 === 0 ? '/incoming' : `/incoming?page=${page - 1}`}
                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                ← 前へ
              </a>
            ) : (
              <span className="px-4 py-2 text-sm text-slate-300 border border-slate-200 rounded-lg">← 前へ</span>
            )}
            <span className="text-xs text-slate-500">{`${page + 1} / ${totalPages} ページ`}</span>
            {page < totalPages - 1 ? (
              <a href={`/incoming?page=${page + 1}`}
                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                次へ →
              </a>
            ) : (
              <span className="px-4 py-2 text-sm text-slate-300 border border-slate-200 rounded-lg">次へ →</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
