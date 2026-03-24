'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/db';
import { getSession } from '@/lib/session';
import { calcOdds } from '@/lib/parimutuel';

export async function placeBet(matchId: string, selection: string, amount: number) {
  const session = await getSession();
  if (!session) return { error: 'ログインが必要です' };

  if (!['home', 'draw', 'away'].includes(selection)) return { error: '無効な選択です' };
  if (!Number.isInteger(amount) || amount < 100) return { error: '最低賭け金は100円です' };

  const { data: user } = await supabase
    .from('users')
    .select('balance')
    .eq('id', session.userId)
    .single();
  if (!user) return { error: 'ユーザーが見つかりません' };
  if (user.balance < amount) return { error: '残高が不足しています' };

  const { data: match } = await supabase
    .from('matches')
    .select('id, status')
    .eq('id', matchId)
    .single();
  if (!match) return { error: '試合が見つかりません' };
  if (match.status !== 'upcoming') return { error: 'この試合はもうベットできません' };

  const id = crypto.randomUUID();

  const { error: betError } = await supabase.from('bets').insert({
    id,
    user_id: session.userId,
    match_id: matchId,
    selection,
    amount,
    placed_at: new Date().toISOString(),
    status: 'pending',
  });
  if (betError) return { error: 'ベットに失敗しました' };

  await supabase
    .from('users')
    .update({ balance: user.balance - amount })
    .eq('id', session.userId);

  revalidatePath('/');
  return { success: true, odds: await calcOdds(matchId) };
}

export async function cancelBet(betId: string) {
  const session = await getSession();
  if (!session) return { error: 'ログインが必要です' };

  const { data: bet } = await supabase
    .from('bets')
    .select('id, amount, status, matches(status, kickoff)')
    .eq('id', betId)
    .eq('user_id', session.userId)
    .single();

  if (!bet) return { error: 'ベットが見つかりません' };
  if (bet.status !== 'pending') return { error: 'キャンセルできません' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const match = (bet as any).matches;
  if (match.status !== 'upcoming' || new Date(match.kickoff) <= new Date()) {
    return { error: '試合が始まっているためキャンセルできません' };
  }

  await supabase.from('bets').update({ status: 'cancelled' }).eq('id', betId);

  const { data: user } = await supabase
    .from('users')
    .select('balance')
    .eq('id', session.userId)
    .single();
  if (user) {
    await supabase
      .from('users')
      .update({ balance: user.balance + bet.amount })
      .eq('id', session.userId);
  }

  revalidatePath('/');
  return { success: true };
}

export async function updateBet(betId: string, newAmount: number) {
  const session = await getSession();
  if (!session) return { error: 'ログインが必要です' };
  if (!Number.isInteger(newAmount) || newAmount < 100) return { error: '最低賭け金は100円です' };

  const { data: bet } = await supabase
    .from('bets')
    .select('id, amount, status, matches(status, kickoff)')
    .eq('id', betId)
    .eq('user_id', session.userId)
    .single();

  if (!bet) return { error: 'ベットが見つかりません' };
  if (bet.status !== 'pending') return { error: '変更できません' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const match = (bet as any).matches;
  if (match.status !== 'upcoming' || new Date(match.kickoff) <= new Date()) {
    return { error: '試合が始まっているため変更できません' };
  }

  const diff = newAmount - bet.amount;
  const { data: user } = await supabase
    .from('users')
    .select('balance')
    .eq('id', session.userId)
    .single();
  if (!user) return { error: 'ユーザーが見つかりません' };
  if (diff > 0 && user.balance < diff) return { error: '残高が不足しています' };

  await supabase.from('bets').update({ amount: newAmount }).eq('id', betId);
  await supabase
    .from('users')
    .update({ balance: user.balance - diff })
    .eq('id', session.userId);

  revalidatePath('/');
  return { success: true };
}
