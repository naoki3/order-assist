'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BetRow } from '@/lib/db';
import { cancelBet, updateBet } from '@/app/actions/betting';

interface BetWithMatch extends BetRow {
  home_team: string;
  away_team: string;
  league: string;
  kickoff: string;
  match_result: string | null;
  match_status: string;
}

interface Props {
  bets: BetWithMatch[];
}

const SELECTION_LABEL = (s: string, home: string, away: string) =>
  s === 'home' ? home : s === 'away' ? away : '引き分け';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-400',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '保留中',
  won: '当選',
  lost: '落選',
  cancelled: 'キャンセル',
};

export default function BetHistory({ bets }: Props) {
  if (bets.length === 0) {
    return <p className="text-center text-gray-400 text-sm py-12">ベット履歴はありません</p>;
  }

  return (
    <div className="space-y-3">
      {bets.map((b) => (
        <BetCard key={b.id} bet={b} />
      ))}
    </div>
  );
}

function BetCard({ bet: b }: { bet: BetWithMatch }) {
  const [editing, setEditing] = useState(false);
  const [newAmount, setNewAmount] = useState(b.amount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const canEdit = b.status === 'pending' && b.match_status === 'upcoming' && new Date(b.kickoff) > new Date();

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const r = await cancelBet(b.id);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  function handleUpdate() {
    setError(null);
    startTransition(async () => {
      const r = await updateBet(b.id, newAmount);
      if (r.error) {
        setError(r.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex justify-between items-start mb-1">
        <span className="text-xs text-gray-400">{b.league}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[b.status] ?? 'bg-gray-100 text-gray-400'}`}>
          {STATUS_LABEL[b.status] ?? b.status}
        </span>
      </div>
      <p className="text-sm font-semibold text-gray-800">
        {b.home_team} vs {b.away_team}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        選択: <span className="font-medium">{SELECTION_LABEL(b.selection, b.home_team, b.away_team)}</span>
      </p>

      {editing ? (
        <div className="mt-3 space-y-2">
          <input
            type="number"
            min={100}
            step={100}
            value={newAmount}
            onChange={(e) => setNewAmount(Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 text-xs border border-gray-200 rounded py-1 text-gray-500"
            >
              戻る
            </button>
            <button
              onClick={handleUpdate}
              disabled={isPending}
              className="flex-1 text-xs bg-green-600 text-white rounded py-1 disabled:opacity-50"
            >
              {isPending ? '更新中...' : '更新する'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-400">賭け金: ¥{b.amount.toLocaleString('ja-JP')}</span>
            {b.payout != null && (
              <span className={`text-xs font-bold ${b.status === 'won' ? 'text-green-600' : 'text-gray-400'}`}>
                {b.status === 'won' ? `+¥${b.payout.toLocaleString('ja-JP')}` : '¥0'}
              </span>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setEditing(true)}
                className="flex-1 text-xs border border-gray-200 rounded py-1 text-gray-600 hover:border-green-400 hover:text-green-600"
              >
                金額変更
              </button>
              <button
                onClick={handleCancel}
                disabled={isPending}
                className="flex-1 text-xs border border-red-200 rounded py-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                {isPending ? '処理中...' : 'キャンセル'}
              </button>
            </div>
          )}
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </>
      )}

      <p className="text-xs text-gray-300 mt-2">
        {new Date(b.placed_at).toLocaleString('ja-JP')}
      </p>
    </div>
  );
}
