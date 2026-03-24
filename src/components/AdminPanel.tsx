'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MatchRow } from '@/lib/db';
import { settleMatch, syncMatches } from '@/app/actions/admin';

interface Props {
  matches: MatchRow[];
  betMap: Record<string, { count: number; total: number }>;
}

const RESULT_OPTIONS = [
  { value: 'home', label: 'ホーム勝ち' },
  { value: 'draw', label: '引き分け' },
  { value: 'away', label: 'アウェイ勝ち' },
];

export default function AdminPanel({ matches, betMap }: Props) {
  const [isPending, startTransition] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [settleMsg, setSettleMsg] = useState<Record<string, string>>({});
  const router = useRouter();

  function handleSync() {
    setSyncMsg(null);
    startTransition(async () => {
      const r = await syncMatches();
      if (r.error) {
        setSyncMsg(`エラー: ${r.error}`);
      } else {
        setSyncMsg(`同期完了: +${r.added}件追加, ${r.updated}件更新`);
        router.refresh();
      }
    });
  }

  function handleSettle(matchId: string, result: string) {
    startTransition(async () => {
      const r = await settleMatch(matchId, result);
      setSettleMsg((prev) => ({
        ...prev,
        [matchId]: r.error ? `エラー: ${r.error}` : '精算完了',
      }));
      router.refresh();
    });
  }

  const pendingMatches = matches.filter((m) => m.status !== 'settled');
  const settledMatches = matches.filter((m) => m.status === 'settled');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">管理パネル</h1>
        <button
          onClick={handleSync}
          disabled={isPending}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? '同期中...' : '試合データ同期'}
        </button>
      </div>

      {syncMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
          {syncMsg}
        </div>
      )}

      {pendingMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">精算待ち ({pendingMatches.length}件)</h2>
          <div className="space-y-3">
            {pendingMatches.map((m) => (
              <MatchSettleCard
                key={m.id}
                match={m}
                bets={betMap[m.id]}
                msg={settleMsg[m.id]}
                onSettle={(r) => handleSettle(m.id, r)}
                disabled={isPending}
              />
            ))}
          </div>
        </section>
      )}

      {settledMatches.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 mb-3">精算済み</h2>
          <div className="space-y-2">
            {settledMatches.map((m) => (
              <div key={m.id} className="bg-white rounded-lg border border-gray-100 p-3 text-sm text-gray-500">
                {m.home_team} vs {m.away_team} — 結果: {m.result}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MatchSettleCard({
  match: m,
  bets,
  msg,
  onSettle,
  disabled,
}: {
  match: MatchRow;
  bets?: { count: number; total: number };
  msg?: string;
  onSettle: (result: string) => void;
  disabled: boolean;
}) {
  const [result, setResult] = useState('home');

  const STATUS_COLOR: Record<string, string> = {
    upcoming: 'text-blue-600',
    live: 'text-red-600',
    finished: 'text-gray-500',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex justify-between items-start mb-1">
        <span className="text-xs text-gray-400">{m.league}</span>
        <span className={`text-xs font-semibold ${STATUS_COLOR[m.status] ?? 'text-gray-500'}`}>
          {m.status}
        </span>
      </div>
      <p className="font-semibold text-gray-800 text-sm">
        {m.home_team} vs {m.away_team}
      </p>
      {bets && (
        <p className="text-xs text-gray-400 mt-0.5">
          {bets.count}件 / 合計 ¥{bets.total.toLocaleString('ja-JP')}
        </p>
      )}

      <div className="flex gap-2 mt-3 items-center">
        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="border border-gray-200 rounded text-sm px-2 py-1 flex-1"
        >
          {RESULT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => onSettle(result)}
          disabled={disabled}
          className="bg-green-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          精算
        </button>
      </div>
      {msg && <p className="text-xs mt-2 text-green-600">{msg}</p>}
    </div>
  );
}
