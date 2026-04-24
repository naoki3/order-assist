'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface SalesTrendPoint {
  date: string;
  total: number;
}

interface BestSeller {
  name: string;
  avgDemand: number;
}

interface Props {
  salesTrend: SalesTrendPoint[];
  bestSellers: BestSeller[];
}

export default function DashboardCharts({ salesTrend, bestSellers }: Props) {
  return (
    <div className="space-y-4">
      {salesTrend.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-600 mb-3">7-Day Sales Trend (Total)</h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={salesTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                labelStyle={{ color: '#475569' }}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="units sold"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: '#3b82f6' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {bestSellers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-600 mb-3">Best Sellers (avg units/day)</h2>
          <ResponsiveContainer width="100%" height={bestSellers.length * 44 + 16}>
            <BarChart
              data={bestSellers}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                allowDecimals={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 12, fill: '#475569' }}
                width={110}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(v) => [typeof v === 'number' ? `${v.toFixed(1)} units/day` : v, 'avg demand']}
              />
              <Bar dataKey="avgDemand" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
