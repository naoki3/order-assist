import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { supabase, MatchRow } from '@/lib/db';
import Header from '@/components/Header';
import AdminPanel from '@/components/AdminPanel';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/');

  const { data: user } = await supabase
    .from('users')
    .select('balance')
    .eq('id', session.userId)
    .single();

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('kickoff', { ascending: false })
    .limit(50);

  const { data: betCounts } = await supabase
    .from('bets')
    .select('match_id, amount')
    .eq('status', 'pending');

  const betMap: Record<string, { count: number; total: number }> = {};
  for (const b of betCounts ?? []) {
    if (!betMap[b.match_id]) betMap[b.match_id] = { count: 0, total: 0 };
    betMap[b.match_id].count++;
    betMap[b.match_id].total += b.amount;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header username={session.username} balance={user?.balance ?? 0} isAdmin={true} />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <AdminPanel matches={(matches ?? []) as MatchRow[]} betMap={betMap} />
      </main>
    </div>
  );
}
