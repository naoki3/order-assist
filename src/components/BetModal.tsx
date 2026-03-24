'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MatchRow } from '@/lib/db';
import { MatchOdds } from '@/lib/parimutuel';
import { placeBet } from '@/app/actions/betting';

interface MatchWithOdds extends MatchRow {
  odds: MatchOdds;
}

interface Props {
  match: MatchWithOdds;
  selection: 'home' | 'draw' | 'away';
  balance: number;
  onClose: () => void;
}

const LABEL = (s: string, home: string, away: string) =>
  s === 'home' ? home : s === 'away' ? away : '引き分け';

export default function BetModal({ match, selection, balance, onClose }: Props) {
  const [amount, setAmount] = useState(1000);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const currentOdds = match.odds[selection] ?? null;
  const potentialPayout = currentOdds !== null ? Math.floor(amount * currentOdds) : null;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await placeBet(match.id, selection, amount);
      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-800 mb-1">ベット</h2>
        <p className="text-sm text-gray-500 mb-4">
          {match.home_team} vs {match.away_team}
        </p>

        <div className="bg-green-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-500">選択</p>
          <p className="font-semibold text-green-700">{LABEL(selection, match.home_team, match.away_team)}</p>
          <p className="text-xs text-gray-400 mt-0.5">現在のオッズ: <span className="font-bold text-green-600">{currentOdds !== null ? currentOdds.toFixed(2) : '-'}</span></p>
          <p className="text-xs text-gray-400">※パリミュチュエル式（ベットが増えるとオッズが変動します）</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">金額（円）</label>
          <input
            type="number"
            min={100}
            max={balance}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1">残高: ¥{balance.toLocaleString('ja-JP')}</p>

          <div className="flex gap-2 mt-2">
            {[500, 1000, 5000].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className="flex-1 text-xs border border-gray-200 rounded py-1 hover:border-green-400 hover:text-green-600"
              >
                ¥{v.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 flex justify-between">
          <span className="text-sm text-gray-500">予想払戻</span>
          <span className="text-sm font-bold text-gray-800">
            {potentialPayout !== null ? `¥${potentialPayout.toLocaleString('ja-JP')}` : '-'}
          </span>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || amount < 100 || amount > balance}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? '処理中...' : 'ベットする'}
          </button>
        </div>
      </div>
    </div>
  );
}
