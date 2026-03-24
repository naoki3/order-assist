'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/db';
import { getSession } from '@/lib/session';
import { fetchRecentMatches } from '@/lib/football';

export async function settleMatch(matchId: string, result: string) {
  const session = await getSession();
  if (!session?.isAdmin) return { error: '権限がありません' };
  if (!['home', 'draw', 'away'].includes(result)) return { error: '無効な結果です' };

  const { data: match } = await supabase
    .from('matches')
    .select('status')
    .eq('id', matchId)
    .single();
  if (!match) return { error: '試合が見つかりません' };
  if (match.status === 'settled') return { error: 'すでに精算済みです' };

  const { error } = await supabase.rpc('settle_match', {
    p_match_id: matchId,
    p_result: result,
  });
  if (error) return { error: '精算に失敗しました: ' + error.message };

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}

export async function syncMatches() {
  const session = await getSession();
  if (!session?.isAdmin) return { error: '権限がありません' };

  const matches = await fetchRecentMatches();
  let added = 0;
  let updated = 0;

  for (const m of matches) {
    const { data: existing } = await supabase
      .from('matches')
      .select('id, status')
      .eq('external_id', m.externalId)
      .single();

    if (!existing) {
      await supabase.from('matches').insert({
        id: crypto.randomUUID(),
        external_id: m.externalId,
        home_team: m.homeTeam,
        away_team: m.awayTeam,
        league: m.league,
        kickoff: m.kickoff,
        status: m.status,
        home_score: m.homeScore,
        away_score: m.awayScore,
        created_at: new Date().toISOString(),
      });
      added++;
    } else if (existing.status !== 'settled') {
      await supabase
        .from('matches')
        .update({ status: m.status, home_score: m.homeScore, away_score: m.awayScore })
        .eq('id', existing.id);
      updated++;
    }
  }

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true, added, updated };
}
