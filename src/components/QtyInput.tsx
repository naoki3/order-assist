'use client';
import { useState } from 'react';
import type { UnitConfig, UnitType } from '@/lib/units';
import { getAvailableUnits, unitToPieces, formatQty, getUnitLabels } from '@/lib/units';
import { useT } from './LanguageProvider';

interface Props {
  name: string;           // form field name — stores pieces
  unitConfig: UnitConfig;
  defaultPieces?: number; // initial value in pieces
  min?: number;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export default function QtyInput({
  name, unitConfig, defaultPieces = 0, min = 1, placeholder, className, inputClassName,
}: Props) {
  const { lang } = useT();
  const unitLabels = getUnitLabels(lang);
  const units = getAvailableUnits(unitConfig);
  const [unit, setUnit] = useState<UnitType>(units[units.length - 1]); // default smallest (piece)
  const [val, setVal] = useState('');
  const qty = Number(val) || 0;
  const pieces = qty > 0 ? unitToPieces(qty, unit, unitConfig) : 0;
  const showPreview = qty > 0 && unit !== 'piece' && unitConfig.pieces_per_ball != null;

  void defaultPieces; // used only for initial state in more complex scenarios

  return (
    <div className={className}>
      <input type="hidden" name={name} value={qty > 0 ? pieces : ''} />
      <div className="flex gap-1">
        <input
          type="number"
          min={min}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          className={inputClassName ?? 'flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'}
        />
        {units.length > 1 ? (
          <select
            value={unit}
            onChange={(e) => { setUnit(e.target.value as UnitType); setVal(''); }}
            className="border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white shrink-0"
          >
            {units.map((u) => <option key={u} value={u}>{unitLabels[u]}</option>)}
          </select>
        ) : (
          <span className="text-sm text-slate-500 self-center px-1 shrink-0">{unitLabels[units[0]]}</span>
        )}
      </div>
      {showPreview && (
        <p className="text-xs text-slate-400 mt-0.5">= {formatQty(pieces, unitConfig)}</p>
      )}
    </div>
  );
}
