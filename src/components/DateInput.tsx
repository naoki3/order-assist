'use client';
import { useState } from 'react';

interface Props {
  value?: string;
  defaultValue?: string;
  onChange?: (val: string) => void;
  name?: string;
  required?: boolean;
  className?: string;
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}/${Number(m)}/${Number(d)}`;
}

export default function DateInput({ value: controlledValue, defaultValue, onChange, name, required, className }: Props) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const value = isControlled ? controlledValue : internalValue;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e.target.value);
  }

  return (
    <div className={`relative border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-green-500 bg-white ${className ?? ''}`}>
      <div className="px-3 py-2 text-sm pointer-events-none select-none">
        {value
          ? <span className="text-slate-800">{formatDisplay(value)}</span>
          : <span className="text-slate-400">YYYY/M/D</span>
        }
      </div>
      <input
        type="date"
        name={name}
        value={isControlled ? value : undefined}
        defaultValue={!isControlled ? defaultValue : undefined}
        onChange={handleChange}
        required={required}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}
