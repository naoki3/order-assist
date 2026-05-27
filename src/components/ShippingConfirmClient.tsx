'use client';

import { useState } from 'react';
import { useT } from './LanguageProvider';
import OutgoingConfirmList from './OutgoingConfirmList';
import LotAllocationList from './LotAllocationList';
import ShippedHistoryList from './ShippedHistoryList';
import type { OutgoingStock, Lot } from '@/lib/db';
import type { UnitConfig } from '@/lib/units';

type Tab = 'allocation' | 'confirm' | 'confirmed';

interface Props {
  pending: OutgoingStock[];
  shipped: OutgoingStock[];
  unitMap: Record<number, UnitConfig>;
  today: string;
  lotsMap: Record<number, Lot[]>;
}

export default function ShippingConfirmClient({ pending, shipped, unitMap, today, lotsMap }: Props) {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('allocation');
  const unallocated = pending.filter((i) => i.allocated_at === null);
  const allocated = pending.filter((i) => i.allocated_at !== null);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'allocation', label: t('shipping.tabAllocation'), count: unallocated.length },
    { key: 'confirm', label: t('shipping.tabShipConfirm'), count: allocated.length },
    { key: 'confirmed', label: t('shipping.tabConfirmed') },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0.5 border-b border-slate-200 mb-4 print:hidden">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px transition-colors flex items-center gap-1.5 ${
              tab === key
                ? 'bg-white border border-b-white border-slate-200 text-slate-800'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab === key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'allocation' && (
        <LotAllocationList
          items={unallocated}
          emptyText={t('shipping.noAllocations')}
          unitMap={unitMap}
          lotsMap={lotsMap}
        />
      )}
      {tab === 'confirm' && (
        <OutgoingConfirmList
          items={allocated}
          emptyText={t('shipping.noPendingAllocated')}
          unitMap={unitMap}
          today={today}
        />
      )}
      {tab === 'confirmed' && (
        <ShippedHistoryList
          items={shipped}
          emptyText={t('shipping.noPending')}
          unitMap={unitMap}
          showDeliveryNote={false}
        />
      )}
    </div>
  );
}
