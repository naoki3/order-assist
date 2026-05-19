'use client';

import { useState } from 'react';
import type { UnitConfig, UnitType } from '@/lib/units';
import { getAvailableUnits, unitToPieces, UNIT_LABELS_JA } from '@/lib/units';

interface Props {
  name: string;          // hidden input stores per-piece value
  unitConfig: UnitConfig;
  defaultPerPiece?: number | null;
  label?: string;
}

export default function FeeRateInput({ name, unitConfig, defaultPerPiece, label }: Props) {
  const units = getAvailableUnits(unitConfig);
  const [unit, setUnit] = useState<UnitType>(units[0]); // default to largest unit

  const initAmount = () => {
    if (defaultPerPiece == null) return '';
    const ppu = unitToPieces(1, units[0], unitConfig);
    return String(Number((defaultPerPiece * ppu).toFixed(6)).toString().replace(/\.?0+$/, ''));
  };
  const [amount, setAmount] = useState(initAmount);

  const piecesPerUnit = unitToPieces(1, unit, unitConfig);
  const perPieceVal = amount !== '' && !isNaN(Number(amount)) ? Number(amount) / piecesPerUnit : '';

  function handleUnitChange(newUnit: UnitType) {
    if (amount !== '' && !isNaN(Number(amount))) {
      const newPpu = unitToPieces(1, newUnit, unitConfig);
      const newAmount = Number(amount) / piecesPerUnit * newPpu;
      setAmount(String(Number(newAmount.toFixed(6)).toString().replace(/\.?0+$/, '')));
    }
    setUnit(newUnit);
  }

  return (
    <label className="flex flex-col gap-0.5 text-slate-600 text-sm">
      {label && <span className="text-xs text-slate-500">{label}</span>}
      <input type="hidden" name={name} value={perPieceVal !== '' ? perPieceVal : ''} />
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="—"
          className="w-20 border border-slate-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <span className="text-sm text-slate-500 shrink-0">円/</span>
        {units.length > 1 ? (
          <select
            value={unit}
            onChange={(e) => handleUnitChange(e.target.value as UnitType)}
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            {units.map((u) => <option key={u} value={u}>{UNIT_LABELS_JA[u]}</option>)}
          </select>
        ) : (
          <span className="text-sm text-slate-500">{UNIT_LABELS_JA[units[0]]}</span>
        )}
      </div>
      {amount !== '' && unit !== 'piece' && perPieceVal !== '' && (
        <p className="text-xs text-slate-400">= {Number(perPieceVal).toFixed(4)}円/ピース</p>
      )}
    </label>
  );
}
