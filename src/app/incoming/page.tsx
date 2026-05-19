import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { translations } from '@/lib/i18n';
import IncomingConfirmList from '@/components/IncomingConfirmList';
import ReceivedHistoryList from '@/components/ReceivedHistoryList';
import type { IncomingStock } from '@/lib/db';
import type { UnitConfig } from '@/lib/units';

export const dynamic = 'force-dynamic';

export default async function IncomingPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const dict = translations[lang];

  const [{ data: pendingData }, { data: receivedData }, { data: productsData }] = await Promise.all([
    supabase.from('incoming_stock').select('*')
      .is('received_at', null)
      .order('expected_date').order('id'),
    supabase.from('incoming_stock').select('*')
      .not('received_at', 'is', null)
      .order('received_at', { ascending: false }).limit(60),
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet'),
  ]);
  const pending = (pendingData ?? []) as IncomingStock[];
  const received = (receivedData ?? []) as IncomingStock[];
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    (productsData ?? []).map((p: { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null }) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{dict['incoming.title']}</h1>
        <p className="text-sm text-slate-500">{dict['incoming.subtitle']}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">{dict['incoming.awaiting']}</h2>
        <IncomingConfirmList items={pending} emptyText={dict['incoming.noAwaiting'] as string} unitMap={unitMap} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">{dict['incoming.received']}</h2>
        <ReceivedHistoryList items={received} emptyText={dict['incoming.noAwaiting'] as string} unitMap={unitMap} />
      </div>
    </div>
  );
}
