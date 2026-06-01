'use client';

import { useState } from 'react';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Anomaly, AnomalyResult } from '@/app/api/ai/anomaly/route';

export default function AnomalyClient() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnomalyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/ai/anomaly', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'エラーが発生しました'); return; }
      setResult(data as AnomalyResult);
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleScan}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          <Sparkles size={15} />
          {loading ? 'スキャン中...' : '異常をスキャン'}
        </button>
        <p className="text-sm text-slate-400">過去90日のデータと直近30日を比較します</p>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
          <Sparkles size={18} className="animate-pulse text-violet-400" />
          <span className="text-sm">全商品の需要データを分析しています...</span>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className={`flex items-start gap-3 rounded-2xl px-5 py-4 border ${result.anomalies.length === 0 ? 'bg-green-50 border-green-100' : 'bg-violet-50 border-violet-100'}`}>
            {result.anomalies.length === 0
              ? <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
              : <AlertTriangle size={18} className="text-violet-600 shrink-0 mt-0.5" />
            }
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {result.anomalies.length === 0
                  ? `異常なし — ${result.scannedProducts}商品をスキャン`
                  : `${result.anomalies.length}件の異常を検知 — ${result.scannedProducts}商品をスキャン`
                }
              </p>
              <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{result.summary}</p>
            </div>
          </div>

          {/* Anomaly cards */}
          {result.anomalies.map((a: Anomaly) => (
            <AnomalyCard key={a.productId} anomaly={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnomalyCard({ anomaly: a }: { anomaly: Anomaly }) {
  const isIncrease = a.type === 'increase';
  const borderColor = isIncrease ? 'border-amber-200' : 'border-red-200';
  const badgeBg = isIncrease ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
  const Icon = isIncrease ? TrendingUp : TrendingDown;
  const iconColor = isIncrease ? 'text-amber-500' : 'text-red-500';

  return (
    <div className={`bg-white border ${borderColor} rounded-2xl p-5 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon size={18} className={`shrink-0 ${iconColor}`} />
          <span className="font-semibold text-slate-800 text-sm">{a.productName}</span>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${badgeBg}`}>
          {a.changeRate > 0 ? '+' : ''}{a.changeRate}%
        </span>
      </div>

      <div className="flex gap-4 text-xs text-slate-500">
        <span>ベースライン日平均: <strong className="text-slate-700">{a.baselineAvg}</strong></span>
        <span>直近30日平均: <strong className={isIncrease ? 'text-amber-700' : 'text-red-700'}>{a.recentAvg}</strong></span>
      </div>

      <div className="space-y-2 text-sm">
        <Row label="分析" value={a.explanation} />
        <Row label="懸念点" value={a.concerns} />
        <Row label="推奨" value={a.recommendation} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs font-semibold text-slate-400 w-12 shrink-0 pt-0.5">{label}</span>
      <span className="text-slate-700 leading-relaxed">{value}</span>
    </div>
  );
}
