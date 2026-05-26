import { createClient } from '@/lib/supabase';
import { getLang, getTz } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { toLocalDateStr } from '@/lib/tz';
import DailyReportClient from '@/components/DailyReportClient';
import type { DailyReportRow } from '@/components/DailyReportClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function DailyReportPage({ searchParams }: PageProps) {
  const [lang, tz, params] = await Promise.all([getLang(), getTz(), searchParams]);
  const today = toLocalDateStr(tz);

  const sevenDaysAgo = (() => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const from = params.from ?? sevenDaysAgo;
  const to = params.to ?? today;

  const supabase = await createClient();

  const [{ data: incomingData }, { data: outgoingData }] = await Promise.all([
    supabase
      .from('incoming_stock')
      .select('product_name, quantity, received_at')
      .not('received_at', 'is', null)
      .gte('received_at', from + 'T00:00:00')
      .lte('received_at', to + 'T23:59:59'),
    supabase
      .from('outgoing_stock')
      .select('product_name, quantity, shipped_at')
      .not('shipped_at', 'is', null)
      .gte('shipped_at', from + 'T00:00:00')
      .lte('shipped_at', to + 'T23:59:59'),
  ]);

  const dataMap = new Map<string, DailyReportRow>();
  const key = (date: string, name: string) => `${date}||${name}`;

  for (const row of incomingData ?? []) {
    if (!row.received_at) continue;
    const date = toLocalDateStr(tz, new Date(row.received_at));
    const k = key(date, row.product_name);
    const existing = dataMap.get(k) ?? { date, product_name: row.product_name, incoming: 0, outgoing: 0 };
    dataMap.set(k, { ...existing, incoming: existing.incoming + row.quantity });
  }

  for (const row of outgoingData ?? []) {
    if (!row.shipped_at) continue;
    const date = toLocalDateStr(tz, new Date(row.shipped_at));
    const k = key(date, row.product_name);
    const existing = dataMap.get(k) ?? { date, product_name: row.product_name, incoming: 0, outgoing: 0 };
    dataMap.set(k, { ...existing, outgoing: existing.outgoing + row.quantity });
  }

  const rows = Array.from(dataMap.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.product_name.localeCompare(b.product_name);
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('dailyReport.title', lang)}</h1>
      <DailyReportClient rows={rows} from={from} to={to} lang={lang} />
    </div>
  );
}
