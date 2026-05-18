import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { translations } from '@/lib/i18n';
import ReceiveForm from '@/components/ReceiveForm';
import type { IncomingStock } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function IncomingPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const dict = translations[lang];

  const [{ data: pendingData }, { data: receivedData }] = await Promise.all([
    supabase.from('incoming_stock').select('*').is('received_at', null).order('expected_date').order('id'),
    supabase.from('incoming_stock').select('*').not('received_at', 'is', null).order('received_at', { ascending: false }).limit(20),
  ]);
  const pending = (pendingData ?? []) as IncomingStock[];
  const received = (receivedData ?? []) as IncomingStock[];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">{dict['incoming.title']}</h1>
      <p className="text-sm text-slate-500 mb-4">{dict['incoming.subtitle']}</p>

      <h2 className="text-sm font-semibold text-slate-600 mb-2">{dict['incoming.awaiting']}</h2>
      {pending.length === 0 ? (
        <p className="text-slate-400 text-sm mb-6">{dict['incoming.noAwaiting']}</p>
      ) : (
        <div className="space-y-2 mb-6">
          {pending.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{item.product_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(dict['incoming.quantity'] as (n: number, d: string) => string)(item.quantity, item.expected_date)}
                </p>
              </div>
              <ReceiveForm id={item.id} />
            </div>
          ))}
        </div>
      )}

      {received.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">{dict['incoming.received']}</h2>
          <div className="space-y-2">
            {received.map((item) => (
              <div key={item.id} className="bg-slate-50 rounded-xl border border-slate-100 p-4 flex items-center justify-between gap-3 opacity-70">
                <div>
                  <p className="font-semibold text-slate-700">{item.product_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(dict['incoming.receivedQty'] as (n: number, d: string) => string)(item.quantity, item.received_at?.slice(0, 10) ?? '')}
                  </p>
                </div>
                <span className="text-xs text-green-600 font-medium">{dict['incoming.receivedLabel']}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
