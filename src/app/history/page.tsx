import { createClient } from '@/lib/supabase';
import type { OrderHistoryItem } from '@/lib/db';
import type { OrderItem } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('order_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  const orders = (data ?? []) as OrderHistoryItem[];

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">Order History</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p>No order history</p>
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
                      <span className="font-semibold text-slate-800">{item.quantity} units</span>
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
