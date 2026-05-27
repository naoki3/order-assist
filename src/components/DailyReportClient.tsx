'use client';

import { Fragment } from 'react';
import type { Lang } from '@/lib/i18n';
import { formatDisplayDate } from '@/lib/tz';

export interface DailyReportRow {
  date: string;
  product_name: string;
  incoming: number;
  outgoing: number;
  stock: number;
}

export interface DailyLotSnapshot {
  date: string;
  lot_number: string;
  product_name: string;
  quantity: number;
  expiry_date: string | null;
  status_name: string | null;
  warehouse_name: string | null;
  location_name: string | null;
}

interface Props {
  rows: DailyReportRow[];
  lotSnapshots: DailyLotSnapshot[];
  from: string;
  to: string;
  lang: Lang;
}

export default function DailyReportClient({ rows, lotSnapshots, from, to, lang }: Props) {
  const isJa = lang === 'ja';
  const L = {
    dateFrom: isJa ? '開始日' : 'From',
    dateTo: isJa ? '終了日' : 'To',
    apply: isJa ? '適用' : 'Apply',
    date: isJa ? '日付' : 'Date',
    product: isJa ? '商品名' : 'Product',
    incoming: isJa ? '入荷数' : 'Incoming',
    outgoing: isJa ? '出荷数' : 'Outgoing',
    stock: isJa ? '在庫数' : 'Stock',
    subtotal: isJa ? '小計' : 'Subtotal',
    total: isJa ? '合計' : 'Total',
    printPdf: isJa ? 'PDFで出力' : 'Print PDF',
    downloadCsv: isJa ? 'CSVダウンロード' : 'Download CSV',
    noData: isJa ? 'データがありません' : 'No data for this period',
    lotDetail: isJa ? '在庫明細' : 'Inventory Detail',
    lotNumber: isJa ? 'ロット番号' : 'Lot Number',
    expiry: isJa ? '賞味期限' : 'Expiry Date',
    status: isJa ? '在庫状態' : 'Status',
    warehouse: isJa ? '倉庫' : 'Warehouse',
    location: isJa ? 'ロケーション' : 'Location',
    lotQty: isJa ? '数量' : 'Qty',
  };

  const dateGroups = new Map<string, DailyReportRow[]>();
  for (const row of rows) {
    const arr = dateGroups.get(row.date) ?? [];
    arr.push(row);
    dateGroups.set(row.date, arr);
  }
  const groupedDates = Array.from(dateGroups.entries());

  function downloadCsv() {
    const bom = '﻿';
    const summaryHeader = isJa
      ? '日付,商品名,入荷数,出荷数,在庫数'
      : 'Date,Product,Incoming,Outgoing,Stock';
    const summaryLines = rows.map((r) =>
      `${r.date},${r.product_name},${r.incoming},${r.outgoing},${r.stock}`
    );

    const detailHeader = isJa
      ? '日付,ロット番号,商品名,数量,賞味期限,在庫状態,倉庫,ロケーション'
      : 'Date,Lot Number,Product,Qty,Expiry Date,Status,Warehouse,Location';
    const detailLines = lotSnapshots.map((s) =>
      `${s.date},${s.lot_number},${s.product_name},${s.quantity},${s.expiry_date ?? ''},${s.status_name ?? ''},${s.warehouse_name ?? ''},${s.location_name ?? ''}`
    );

    const content = [summaryHeader, ...summaryLines, '', detailHeader, ...detailLines].join('\n');
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
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
        <>
          {/* Summary table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 w-32">{L.date}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{L.product}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 w-24">{L.incoming}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 w-24">{L.outgoing}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 w-24">{L.stock}</th>
                </tr>
              </thead>
              <tbody>
                {groupedDates.map(([date, dateRows]) => {
                  const totalIn = dateRows.reduce((s, r) => s + r.incoming, 0);
                  const totalOut = dateRows.reduce((s, r) => s + r.outgoing, 0);
                  const totalStock = dateRows.reduce((s, r) => s + r.stock, 0);
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
                          <td className="px-4 py-2 text-right tabular-nums">
                            {row.stock > 0
                              ? <span className="text-slate-700 font-medium">{row.stock}</span>
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
                          <td className="px-4 py-1 text-right text-xs font-semibold tabular-nums text-slate-700">
                            {totalStock > 0 ? totalStock : <span className="text-slate-300">—</span>}
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
                  <td className="px-4 py-2 text-right font-bold text-slate-700 tabular-nums">
                    —
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Lot detail — print only */}
          {lotSnapshots.length > 0 && (
            <div className="mt-8 hidden print:block">
              <h2 className="text-sm font-bold text-slate-700 mb-2">{L.lotDetail}</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-1 text-left">{L.date}</th>
                    <th className="border border-slate-300 px-2 py-1 text-left">{L.lotNumber}</th>
                    <th className="border border-slate-300 px-2 py-1 text-left">{L.product}</th>
                    <th className="border border-slate-300 px-2 py-1 text-right">{L.lotQty}</th>
                    <th className="border border-slate-300 px-2 py-1 text-left">{L.expiry}</th>
                    <th className="border border-slate-300 px-2 py-1 text-left">{L.status}</th>
                    <th className="border border-slate-300 px-2 py-1 text-left">{L.warehouse}</th>
                    <th className="border border-slate-300 px-2 py-1 text-left">{L.location}</th>
                  </tr>
                </thead>
                <tbody>
                  {lotSnapshots.map((s, i) => (
                    <tr key={i} className="border-b border-slate-200">
                      <td className="border border-slate-300 px-2 py-0.5">{formatDisplayDate(s.date)}</td>
                      <td className="border border-slate-300 px-2 py-0.5 font-mono">{s.lot_number}</td>
                      <td className="border border-slate-300 px-2 py-0.5">{s.product_name}</td>
                      <td className="border border-slate-300 px-2 py-0.5 text-right">{s.quantity}</td>
                      <td className="border border-slate-300 px-2 py-0.5">{s.expiry_date ? formatDisplayDate(s.expiry_date) : '—'}</td>
                      <td className="border border-slate-300 px-2 py-0.5">{s.status_name ?? '—'}</td>
                      <td className="border border-slate-300 px-2 py-0.5">{s.warehouse_name ?? '—'}</td>
                      <td className="border border-slate-300 px-2 py-0.5">{s.location_name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
