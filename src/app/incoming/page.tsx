import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { translations } from '@/lib/i18n';
import IncomingConfirmList from '@/components/IncomingConfirmList';
import ReceivedHistoryList from '@/components/ReceivedHistoryList';
import type { ReceiptWithLines, ReceiptLine } from '@/lib/db';
import type { UnitConfig } from '@/lib/units';
import { cookies } from 'next/headers';
import { toLocalDateStr, DEFAULT_TZ } from '@/lib/tz';

export const dynamic = 'force-dynamic';

/** Flatten receipt+lines into a list of IncomingStock-shaped objects for existing components. */
function flattenReceipts(receipts: ReceiptWithLines[]) {
  return receipts.flatMap((r) =>
    r.receipt_lines.map((line: ReceiptLine) => ({
      ...line,
      quantity: line.expected_qty,
      receipt_no: r.receipt_no,
      receipt_type: r.receipt_type,
      receipt_status: r.status,
      supplier_id: r.supplier_id,
      supplier_name: r.supplier_name,
      warehouse_id: r.warehouse_id,
      warehouse_name: r.warehouse_name,
      order_history_id: r.order_history_id,
      expected_date: r.expected_date,
      received_at: r.received_at,
    }))
  );
}

export default async function IncomingPage() {
  const [supabase, lang, cookieStore] = await Promise.all([createClient(), getLang(), cookies()]);
  const dict = translations[lang];
  const today = toLocalDateStr(cookieStore.get('tz')?.value ?? DEFAULT_TZ);

  const [{ data: pendingData }, { data: receivedData }, { data: productsData }, { data: locationsData }] = await Promise.all([
    supabase.from('receipts')
      .select('*, receipt_lines(*)')
      .eq('status', 'expected')
      .order('expected_date', { ascending: false })
      .order('id'),
    supabase.from('receipts')
      .select('*, receipt_lines(*)')
      .eq('status', 'received')
      .order('received_at', { ascending: false })
      .limit(60),
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet, expiry_type'),
    supabase.from('locations').select('id, name, warehouse_id').order('name'),
  ]);

  const pending = flattenReceipts((pendingData ?? []) as ReceiptWithLines[]);
  const received = flattenReceipts((receivedData ?? []) as ReceiptWithLines[]);

  type ProductRow = { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null; expiry_type: string | null };
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    (productsData ?? []).map((p: ProductRow) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );
  const expiryTypeMap: Record<number, string | null> = Object.fromEntries(
    (productsData ?? []).map((p: ProductRow) => [p.id, p.expiry_type ?? null])
  );
  const locations = (locationsData ?? []) as { id: number; name: string; warehouse_id: number | null }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{dict['incoming.title']}</h1>
        <p className="text-sm text-slate-500">{dict['incoming.subtitle']}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">{dict['incoming.awaiting']}</h2>
        <IncomingConfirmList items={pending} emptyText={dict['incoming.noAwaiting'] as string} unitMap={unitMap} expiryTypeMap={expiryTypeMap} today={today} locations={locations} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">{dict['incoming.received']}</h2>
        <ReceivedHistoryList items={received} emptyText={dict['incoming.noAwaiting'] as string} unitMap={unitMap} />
      </div>
    </div>
  );
}
