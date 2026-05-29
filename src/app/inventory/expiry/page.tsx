import { createClient } from '@/lib/supabase';
import { getLang, getTz } from '@/lib/lang';
import { t, type Lang } from '@/lib/i18n';
import { toLocalDateStr } from '@/lib/tz';
import { formatDisplayDate } from '@/lib/tz';
import type { Lot } from '@/lib/db';

export const dynamic = 'force-dynamic';

const COLOR_MAP: Record<string, string> = {
  slate:  'bg-slate-100 text-slate-700',
  red:    'bg-red-100 text-red-700',
  amber:  'bg-amber-100 text-amber-700',
  green:  'bg-green-100 text-green-700',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
};

function StatusBadge({ name, color }: { name: string; color: string | null }) {
  const cls = COLOR_MAP[color ?? ''] ?? COLOR_MAP.slate;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {name}
    </span>
  );
}

function diffDays(today: string, expiryDate: string): number {
  const a = new Date(today + 'T12:00:00Z');
  const b = new Date(expiryDate + 'T12:00:00Z');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

interface LotWithDays extends Lot {
  daysLeft: number;
}

function LotTable({ items, colorClass, lang }: {
  items: LotWithDays[];
  colorClass: string;
  lang: Lang;
}) {
  const isJa = lang === 'ja';
  const daysText = (lot: LotWithDays) =>
    lot.daysLeft < 0
      ? (isJa ? `${Math.abs(lot.daysLeft)}日超過` : `${Math.abs(lot.daysLeft)}d overdue`)
      : (isJa ? `残${lot.daysLeft}日` : `${lot.daysLeft}d left`);

  if (items.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className={`border-b border-slate-200 ${colorClass}`}>
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">{t('inventory.lotExpiry', lang)}</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">{t('inventory.lotNumber', lang)}</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">{t('dailyReport.product', lang)}</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">{t('inventory.lotQty', lang)}</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 hidden sm:table-cell">{t('inventory.correctionStatus', lang)}</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 hidden md:table-cell">{t('incoming.warehouseScheduled', lang)}</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 hidden md:table-cell">{t('inventory.location', lang)}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((lot) => (
            <tr key={lot.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2 font-mono text-xs text-slate-700">
                <div>{formatDisplayDate(lot.expiry_date!)}</div>
                <div className={`text-xs font-semibold ${lot.daysLeft < 0 ? 'text-red-600' : lot.daysLeft <= 7 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {daysText(lot)}
                </div>
              </td>
              <td className="px-4 py-2 font-mono text-xs text-slate-700">{lot.lot_number}</td>
              <td className="px-4 py-2 text-slate-800">{lot.product_name}</td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-700">{lot.quantity}</td>
              <td className="px-4 py-2 hidden sm:table-cell">
                {lot.status_name
                  ? <StatusBadge name={lot.status_name} color={lot.status_color ?? null} />
                  : <span className="text-slate-300 text-xs">—</span>}
              </td>
              <td className="px-4 py-2 text-xs text-slate-500 hidden md:table-cell">{lot.warehouse_name ?? '—'}</td>
              <td className="px-4 py-2 text-xs text-slate-500 hidden md:table-cell">{lot.location_name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ExpiryAlertPage() {
  const [lang, tz] = await Promise.all([getLang(), getTz()]);
  const today = toLocalDateStr(tz);

  const supabase = await createClient();
  const { data } = await supabase
    .from('lots')
    .select('*')
    .not('expiry_date', 'is', null)
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true })
    .limit(2000);

  const lots = ((data ?? []) as Lot[]).map((l) => ({
    ...l,
    daysLeft: diffDays(today, l.expiry_date!),
  })) as LotWithDays[];

  const expired = lots.filter((l) => l.daysLeft < 0);
  const within7 = lots.filter((l) => l.daysLeft >= 0 && l.daysLeft <= 7);
  const within30 = lots.filter((l) => l.daysLeft > 7 && l.daysLeft <= 30);
  const over30 = lots.filter((l) => l.daysLeft > 30);

  const hasAny = lots.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('inventory.expiryAlertTitle', lang)}</h1>
        <p className="text-sm text-slate-500">{t('inventory.expiryAlertSubtitle', lang)}</p>
      </div>

      {!hasAny ? (
        <p className="text-slate-400 text-sm">{t('inventory.noExpiryAlert', lang)}</p>
      ) : (
        <>
          {expired.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {t('inventory.expired', lang)}
                <span className="ml-1 text-xs font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{expired.length}</span>
              </h2>
              <LotTable items={expired} colorClass="bg-red-50" lang={lang} />
            </section>
          )}

          {within7.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-amber-600 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                {t('inventory.expiryWithin7', lang)}
                <span className="ml-1 text-xs font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{within7.length}</span>
              </h2>
              <LotTable items={within7} colorClass="bg-amber-50" lang={lang} />
            </section>
          )}

          {within30.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-yellow-600 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                {t('inventory.expiryWithin30', lang)}
                <span className="ml-1 text-xs font-semibold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">{within30.length}</span>
              </h2>
              <LotTable items={within30} colorClass="bg-yellow-50" lang={lang} />
            </section>
          )}

          {over30.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                {t('inventory.expiryOver30', lang)}
                <span className="ml-1 text-xs font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{over30.length}</span>
              </h2>
              <LotTable items={over30} colorClass="bg-slate-50" lang={lang} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
