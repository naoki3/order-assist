import { getDb } from '@/lib/db';
import { receiveIncoming } from '@/lib/actions';
import type { IncomingStock } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function IncomingPage() {
  const db = getDb();
  const pending = db
    .prepare(
      'SELECT * FROM incoming_stock WHERE received_at IS NULL ORDER BY expected_date ASC, id ASC'
    )
    .all() as IncomingStock[];
  const received = db
    .prepare(
      'SELECT * FROM incoming_stock WHERE received_at IS NOT NULL ORDER BY received_at DESC LIMIT 20'
    )
    .all() as IncomingStock[];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">入荷管理</h1>
      <p className="text-sm text-slate-500 mb-4">入荷済みにすると在庫に自動加算されます</p>

      {/* Pending */}
      <h2 className="text-sm font-semibold text-slate-600 mb-2">入荷待ち</h2>
      {pending.length === 0 ? (
        <p className="text-slate-400 text-sm mb-6">入荷待ちの商品はありません</p>
      ) : (
        <div className="space-y-2 mb-6">
          {pending.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{item.product_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.quantity}個 · 入荷予定 {item.expected_date}
                </p>
              </div>
              <form action={receiveIncoming}>
                <input type="hidden" name="id" value={item.id} />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                >
                  入荷済み
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {/* Received history */}
      {received.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">入荷済み（直近20件）</h2>
          <div className="space-y-2">
            {received.map((item) => (
              <div key={item.id} className="bg-slate-50 rounded-xl border border-slate-100 p-4 flex items-center justify-between gap-3 opacity-70">
                <div>
                  <p className="font-semibold text-slate-700">{item.product_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.quantity}個 · 入荷済み {item.received_at?.slice(0, 10)}
                  </p>
                </div>
                <span className="text-xs text-green-600 font-medium">入荷済</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
