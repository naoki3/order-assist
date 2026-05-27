'use client';

import { useState } from 'react';
import { useT } from './LanguageProvider';
import OutgoingConfirmList from './OutgoingConfirmList';
import LotAllocationList from './LotAllocationList';
import ShippedHistoryList from './ShippedHistoryList';
import type { OutgoingStock } from '@/lib/db';
import type { UnitConfig } from '@/lib/units';

type Tab = 'allocation' | 'confirm' | 'confirmed';

interface Props {
  pending: OutgoingStock[];
  shipped: OutgoingStock[];
  unitMap: Record<number, UnitConfig>;
  today: string;
}

export default function ShippingConfirmClient({ pending, shipped, unitMap, today }: Props) {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('allocation');
  const allocated = pending.filter((i) => i.lot_id !== null);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'allocation', label: t('shipping.tabAllocation') },
    { key: 'confirm', label: t('shipping.tabShipConfirm') },
    { key: 'confirmed', label: t('shipping.tabConfirmed') },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0.5 border-b border-slate-200 mb-4 print:hidden">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px transition-colors ${
              tab === key
                ? 'bg-white border border-b-white border-slate-200 text-slate-800'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'allocation' && (
        <LotAllocationList
          items={allocated}
          emptyText={t('shipping.noAllocations')}
          unitMap={unitMap}
        />
      )}
      {tab === 'confirm' && (
        <OutgoingConfirmList
          items={pending}
          emptyText={t('shipping.noPending')}
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
