import { getDb } from '@/lib/db';
import { upsertSale } from '@/lib/actions';
import type { Product, Sale } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function SalesPage() {
  const db = getDb();
  const products = db.prepare('SELECT * FROM products ORDER BY id').all() as Product[];

  // Show last 7 days for input
  const today = new Date('2026-03-24');
  const dates: string[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Fetch existing sales for last 7 days
  const sales = db
    .prepare(
      `SELECT * FROM sales WHERE product_id IN (SELECT id FROM products) AND date IN (${dates.map(() => '?').join(',')}) ORDER BY product_id, date DESC`
    )
    .all(...dates) as Sale[];

  // Build a lookup map: productId -> date -> quantity
  const salesMap: Record<number, Record<string, number>> = {};
  for (const s of sales) {
    if (!salesMap[s.product_id]) salesMap[s.product_id] = {};
    salesMap[s.product_id][s.date] = s.quantity;
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">売上入力</h1>
      <p className="text-sm text-slate-500 mb-4">過去7日分の実売数を入力してください</p>

      {products.length === 0 ? (
        <p className="text-slate-400 text-sm">商品が登録されていません</p>
      ) : (
        <div className="space-y-4">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-800 mb-3">{p.name}</p>
              <div className="space-y-2">
                {dates.map((date) => (
                  <form key={date} action={upsertSale} className="flex items-center gap-3">
                    <input type="hidden" name="product_id" value={p.id} />
                    <input type="hidden" name="date" value={date} />
                    <span className="text-sm text-slate-500 w-10 shrink-0">{formatDate(date)}</span>
                    <input
                      type="number"
                      name="quantity"
                      defaultValue={salesMap[p.id]?.[date] ?? 0}
                      min={0}
                      required
                      className="w-20 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-400">個</span>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      保存
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
