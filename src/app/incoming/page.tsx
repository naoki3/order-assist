import { createClient } from '@/lib/supabase';
import ReceiveForm from '@/components/ReceiveForm';
import type { IncomingStock } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function IncomingPage() {
  const supabase = await createClient();

  const { data: pendingData } = await supabase
    .from('incoming_stock')
    .select('*')
    .is('received_at', null)
    .order('expected_date')
    .order('id');
  const pending = (pendingData ?? []) as IncomingStock[];

  const { data: receivedData } = await supabase
    .from('incoming_stock')
    .select('*')
    .not('received_at', 'is', null)
    .order('received_at', { ascending: false })
    .limit(20);
  const received = (receivedData ?? []) as IncomingStock[];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">Incoming Stock</h1>
      <p className="text-sm text-slate-500 mb-4">Marking as received automatically adds to inventory</p>

      <h2 className="text-sm font-semibold text-slate-600 mb-2">Awaiting Delivery</h2>
      {pending.length === 0 ? (
        <p className="text-slate-400 text-sm mb-6">No items awaiting delivery</p>
      ) : (
        <div className="space-y-2 mb-6">
          {pending.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{item.product_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.quantity} units · Expected {item.expected_date}
                </p>
              </div>
              <ReceiveForm id={item.id} />
            </div>
          ))}
        </div>
      )}

      {received.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">Received (Last 20)</h2>
          <div className="space-y-2">
            {received.map((item) => (
              <div key={item.id} className="bg-slate-50 rounded-xl border border-slate-100 p-4 flex items-center justify-between gap-3 opacity-70">
                <div>
                  <p className="font-semibold text-slate-700">{item.product_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.quantity} units · Received {item.received_at?.slice(0, 10)}
                  </p>
                </div>
                <span className="text-xs text-green-600 font-medium">Received</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
