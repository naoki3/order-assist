'use client';

import { useState } from 'react';
import { MatchRow } from '@/lib/db';
import { MatchOdds } from '@/lib/parimutuel';
import BetModal from './BetModal';

interface MatchWithOdds extends MatchRow {
  odds: MatchOdds;
}

interface Props {
  matches: MatchWithOdds[];
  balance: number;
}

const STATUS_LABEL: Record<string, string> = {
  upcoming: '開催前',
  live: 'LIVE',
  finished: '終了',
  settled: '精算済',
};

const STATUS_COLOR: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-700',
  live: 'bg-red-100 text-red-700 animate-pulse',
  finished: 'bg-gray-100 text-gray-500',
  settled: 'bg-green-100 text-green-700',
};

const OUTCOME_LABEL = (o: string, home: string, away: string) =>
  o === 'home' ? home : o === 'away' ? away : '引き分け';

export default function MatchList({ matches, balance }: Props) {
  const [betting, setBetting] = useState<{
    match: MatchWithOdds;
    selection: 'home' | 'draw' | 'away';
  } | null>(null);

  const upcoming = matches.filter((m) => m.status === 'upcoming' || m.status === 'live');
  const done = matches.filter((m) => m.status === 'finished' || m.status === 'settled');

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        試合データがありません。管理者がデータを同期するまでお待ちください。
      </div>
    );
  }

  return (
    <>
      {upcoming.length > 0 && (
        <section className="space-y-3 mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">開催前 / LIVE</h2>
          {upcoming.map((m) => (
            <MatchCard key={m.id} match={m} onBet={(s) => setBetting({ match: m, selection: s })} />
          ))}
        </section>
      )}
      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">終了した試合</h2>
          {done.map((m) => (
            <MatchCard key={m.id} match={m} onBet={() => {}} />
          ))}
        </section>
      )}

      {betting && (
        <BetModal
          match={betting.match}
          selection={betting.selection}
          balance={balance}
          onClose={() => setBetting(null)}
        />
      )}
    </>
  );
}

function MatchCard({
  match: m,
  onBet,
}: {
  match: MatchWithOdds;
  onBet: (s: 'home' | 'draw' | 'away') => void;
}) {
  const canBet = m.status === 'upcoming';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{m.league}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[m.status]}`}>
          {STATUS_LABEL[m.status]}
        </span>
      </div>

      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-sm text-gray-800 flex-1 text-left">{m.home_team}</span>
        {m.home_score != null && m.away_score != null ? (
          <span className="text-lg font-bold text-gray-700 px-3">
            {m.home_score} - {m.away_score}
          </span>
        ) : (
          <span className="text-xs text-gray-400 px-3">
            {new Date(m.kickoff).toLocaleString('ja-JP', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
        <span className="font-semibold text-sm text-gray-800 flex-1 text-right">{m.away_team}</span>
      </div>

      {m.result && (
        <p className="text-xs text-center text-green-600 font-medium mb-2">
          結果: {OUTCOME_LABEL(m.result, m.home_team, m.away_team)}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 mt-3">
        {(['home', 'draw', 'away'] as const).map((sel) => {
          const o = m.odds[sel];
          const label = sel === 'home' ? m.home_team : sel === 'away' ? m.away_team : '引き分け';
          return (
            <button
              key={sel}
              onClick={() => canBet && onBet(sel)}
              disabled={!canBet}
              className={`rounded-lg py-2 px-1 text-center transition-colors border ${
                canBet
                  ? 'border-green-200 bg-green-50 hover:bg-green-100 cursor-pointer'
                  : 'border-gray-100 bg-gray-50 cursor-default'
              }`}
            >
              <p className="text-xs text-gray-500 truncate">{label}</p>
              <p className="text-sm font-bold text-green-700">
                {o !== null ? o.toFixed(2) : '-'}
              </p>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-right mt-1">
        プール: ¥{m.odds.totalPool.toLocaleString('ja-JP')}
      </p>
    </div>
  );
}
