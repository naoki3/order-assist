import { getDb } from '@/lib/db';
import type { OrderHistoryItem } from '@/lib/db';
import type { OrderItem } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  const db = getDb();
  const orders = db
    .prepare('SELECT * FROM order_history ORDER BY created_at DESC LIMIT 50')
    .all() as OrderHistoryItem[];

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">発注履歴</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p>発注履歴がありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const items = JSON.parse(order.items) as OrderItem[];
            return (
              <div key={order.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-400 mb-2">{formatDate(order.created_at)}</p>
                <div className="space-y-1">
                  {items.map((item) => (
                    <div key={item.productId} className="flex justify-between text-sm">
                      <span className="text-slate-700">{item.productName}</span>
                      <span className="font-semibold text-slate-800">{item.quantity}個</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
