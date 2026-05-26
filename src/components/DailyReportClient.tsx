'use client';

import { Fragment } from 'react';
import type { Lang } from '@/lib/i18n';
import { formatDisplayDate } from '@/lib/tz';

export interface DailyReportRow {
  date: string;
  product_name: string;
  incoming: number;
  outgoing: number;
}

interface Props {
  rows: DailyReportRow[];
  from: string;
  to: string;
  lang: Lang;
}

export default function DailyReportClient({ rows, from, to, lang }: Props) {
  const isJa = lang === 'ja';
  const L = {
    dateFrom: isJa ? '開始日' : 'From',
    dateTo: isJa ? '終了日' : 'To',
    apply: isJa ? '適用' : 'Apply',
    date: isJa ? '日付' : 'Date',
    product: isJa ? '商品名' : 'Product',
    incoming: isJa ? '入荷数' : 'Incoming',
    outgoing: isJa ? '出荷数' : 'Outgoing',
    subtotal: isJa ? '小計' : 'Subtotal',
    total: isJa ? '合計' : 'Total',
    printPdf: isJa ? 'PDFで出力' : 'Print PDF',
    downloadCsv: isJa ? 'CSVダウンロード' : 'Download CSV',
    noData: isJa ? 'データがありません' : 'No data for this period',
  };

  const dateGroups = new Map<string, DailyReportRow[]>();
  for (const row of rows) {
    const arr = dateGroups.get(row.date) ?? [];
    arr.push(row);
    dateGroups.set(row.date, arr);
  }
  const groupedDates = Array.from(dateGroups.entries());

  function downloadCsv() {
    const header = isJa ? '日付,商品名,入荷数,出荷数' : 'Date,Product,Incoming,Outgoing';
    const lines = [header, ...rows.map((r) => `${r.date},${r.product_name},${r.incoming},${r.outgoing}`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-report-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-4 print:hidden">
        <form method="GET" action="/report/daily" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">{L.dateFrom}</span>
            <input
              type="date" name="from" defaultValue={from}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">{L.dateTo}</span>
            <input
              type="date" name="to" defaultValue={to}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>
          <button
            type="submit"
            className="px-4 py-1.5 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium"
          >
            {L.apply}
          </button>
        </form>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={downloadCsv}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {L.downloadCsv}
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            {L.printPdf}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-400 text-sm">{L.noData}</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 w-32">{L.date}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{L.product}</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 w-24">{L.incoming}</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 w-24">{L.outgoing}</th>
              </tr>
            </thead>
            <tbody>
              {groupedDates.map(([date, dateRows]) => {
                const totalIn = dateRows.reduce((s, r) => s + r.incoming, 0);
                const totalOut = dateRows.reduce((s, r) => s + r.outgoing, 0);
                return (
                  <Fragment key={date}>
                    {dateRows.map((row, i) => (
                      <tr key={row.product_name} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-600 text-xs font-mono align-top">
                          {i === 0 ? formatDisplayDate(date) : ''}
                        </td>
                        <td className="px-4 py-2 text-slate-800">{row.product_name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {row.incoming > 0
                            ? <span className="text-green-700 font-medium">{row.incoming}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {row.outgoing > 0
                            ? <span className="text-blue-700 font-medium">{row.outgoing}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))}
                    {dateRows.length > 1 && (
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <td className="px-4 py-1" />
                        <td className="px-4 py-1 text-xs text-slate-400 italic">{L.subtotal}</td>
                        <td className="px-4 py-1 text-right text-xs font-semibold tabular-nums">
                          {totalIn > 0 ? <span className="text-green-700">{totalIn}</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-1 text-right text-xs font-semibold tabular-nums">
                          {totalOut > 0 ? <span className="text-blue-700">{totalOut}</span> : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-200">
              <tr>
                <td className="px-4 py-2 font-semibold text-slate-700 text-xs" colSpan={2}>{L.total}</td>
                <td className="px-4 py-2 text-right font-bold text-green-700 tabular-nums">
                  {rows.reduce((s, r) => s + r.incoming, 0)}
                </td>
                <td className="px-4 py-2 text-right font-bold text-blue-700 tabular-nums">
                  {rows.reduce((s, r) => s + r.outgoing, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
