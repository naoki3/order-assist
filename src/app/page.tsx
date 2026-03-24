import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/db';
import { calcOdds } from '@/lib/parimutuel';
import { MatchRow, BetRow } from '@/lib/db';
import Header from '@/components/Header';
import MatchList from '@/components/MatchList';
import BetHistory from '@/components/BetHistory';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const tab = params.tab === 'history' ? 'history' : 'matches';

  const { data: user } = await supabase
    .from('users')
    .select('balance')
    .eq('id', session.userId)
    .single();
  const balance = user?.balance ?? 0;

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .in('status', ['upcoming', 'live', 'finished', 'settled'])
    .order('kickoff', { ascending: true });

  const matchesWithOdds = await Promise.all(
    (matches ?? []).map(async (m: MatchRow) => ({
      ...m,
      odds: await calcOdds(m.id),
    }))
  );

  const { data: rawBets } = await supabase
    .from('bets')
    .select('*, matches(home_team, away_team, league, kickoff, result, status)')
    .eq('user_id', session.userId)
    .order('placed_at', { ascending: false });

  const bets = (rawBets ?? []).map((b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { matches: m, ...rest } = b as any;
    return {
      ...(rest as BetRow),
      home_team: m.home_team as string,
      away_team: m.away_team as string,
      league: m.league as string,
      kickoff: m.kickoff as string,
      match_result: m.result as string | null,
      match_status: m.status as string,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header username={session.username} balance={balance} isAdmin={session.isAdmin} />

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex border-b border-gray-200 mt-4">
          <a
            href="/?tab=matches"
            className={`flex-1 py-2 text-sm font-medium text-center border-b-2 -mb-px transition-colors ${
              tab === 'matches'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            試合一覧
          </a>
          <a
            href="/?tab=history"
            className={`flex-1 py-2 text-sm font-medium text-center border-b-2 -mb-px transition-colors ${
              tab === 'history'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ベット履歴 ({bets.length})
          </a>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {tab === 'matches' && <MatchList matches={matchesWithOdds} balance={balance} />}
        {tab === 'history' && <BetHistory bets={bets} />}
      </main>
    </div>
  );
}
