import { supabase } from './db';

const HOUSE_EDGE = 0; // 仲間内なので手数料なし

export interface MatchOdds {
  home: number | null;
  draw: number | null;
  away: number | null;
  pool: { home: number; draw: number; away: number };
  totalPool: number;
}

export async function calcOdds(matchId: string): Promise<MatchOdds> {
  const { data } = await supabase
    .from('bets')
    .select('selection, amount')
    .eq('match_id', matchId)
    .eq('status', 'pending');

  const pool: Record<string, number> = { home: 0, draw: 0, away: 0 };
  for (const r of data ?? []) {
    pool[r.selection] = (pool[r.selection] ?? 0) + r.amount;
  }

  const totalPool = pool.home + pool.draw + pool.away;
  const netPool = totalPool * (1 - HOUSE_EDGE);

  function odds(selection: 'home' | 'draw' | 'away'): number | null {
    if (pool[selection] === 0 || totalPool === 0) return null;
    return parseFloat((netPool / pool[selection]).toFixed(2));
  }

  return {
    home: odds('home'),
    draw: odds('draw'),
    away: odds('away'),
    pool: { home: pool.home, draw: pool.draw, away: pool.away },
    totalPool,
  };
}

export async function calcPayout(matchId: string, selection: string, amount: number): Promise<number> {
  const odds = await calcOdds(matchId);
  const o = odds[selection as 'home' | 'draw' | 'away'] ?? 1;
  return Math.floor(amount * o);
}
