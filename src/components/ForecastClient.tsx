'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Sparkles, TrendingUp } from 'lucide-react';

type Product = { id: number; name: string };

type Prediction = { month: string; quantity: number; confidence: 'high' | 'medium' | 'low' };

type ForecastResult = {
  historical: [string, number][];
  predictions: Prediction[];
  reasoning: string;
};

const confidenceLabel = { high: '高', medium: '中', low: '低' };
const confidenceColor = { high: 'text-green-600 bg-green-50', medium: 'text-yellow-600 bg-yellow-50', low: 'text-slate-500 bg-slate-100' };

export default function ForecastClient({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleForecast() {
    if (!productId) return;
    const product = products.find((p) => p.id === Number(productId));
    if (!product) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/ai/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, productName: product.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'エラーが発生しました');
        return;
      }
      setResult(data as ForecastResult);
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  const chartData = result
    ? [
        ...result.historical.map(([month, quantity]) => ({ month, quantity, type: 'historical' as const })),
        ...result.predictions.map(({ month, quantity }) => ({ month, quantity, type: 'predicted' as const })),
      ]
    : [];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Controls */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">商品を選択</label>
          <select
            value={productId}
            onChange={(e) => { setProductId(e.target.value); setResult(null); setError(null); }}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          >
            <option value="">-- 商品を選んでください --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleForecast}
          disabled={!productId || loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors shrink-0"
        >
          <Sparkles size={15} />
          {loading ? '予測中...' : '予測する'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
          <Sparkles size={18} className="animate-pulse text-violet-400" />
          <span className="text-sm">AIが過去データを分析しています...</span>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-5">
          {/* Chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <TrendingUp size={15} className="text-violet-500" />
              月次出荷数量（実績 + 予測）
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v, _n, props) => [
                    `${v}`,
                    props.payload.type === 'predicted' ? '予測' : '実績',
                  ]}
                />
                <Legend
                  formatter={(value) => value === 'quantity' ? undefined : value}
                  wrapperStyle={{ display: 'none' }}
                />
                <Bar dataKey="quantity" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.type === 'predicted' ? '#7c3aed' : '#cbd5e1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-300 inline-block" />実績</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-violet-600 inline-block" />予測</span>
            </div>
          </div>

          {/* Predictions table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">月</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">予測数量</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">信頼度</th>
                </tr>
              </thead>
              <tbody>
                {result.predictions.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-800">{p.month}</td>
                    <td className="px-5 py-3 text-right font-semibold text-violet-700">{p.quantity.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidenceColor[p.confidence]}`}>
                        {confidenceLabel[p.confidence]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reasoning */}
          <div className="bg-violet-50 border border-violet-100 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-violet-700 mb-1.5 flex items-center gap-1.5">
              <Sparkles size={13} />
              AIの分析コメント
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">{result.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  );
}
