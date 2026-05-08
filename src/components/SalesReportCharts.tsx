'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface TrendPoint {
  date: string;
  units: number;
  revenue: number | null;
}

interface Props {
  trend: TrendPoint[];
  hasRevenue: boolean;
}

export default function SalesReportCharts({ trend, hasRevenue }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-slate-600 mb-3">Sales Trend</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis yAxisId="units" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
          {hasRevenue && (
            <YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          )}
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
          {hasRevenue && <Legend wrapperStyle={{ fontSize: 12 }} />}
          <Line
            yAxisId="units"
            type="monotone"
            dataKey="units"
            name="Units"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          {hasRevenue && (
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#15803d"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
