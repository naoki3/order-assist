'use client';
import { useRef, useState } from 'react';

interface Props {
  value?: string;
  defaultValue?: string;
  onChange?: (val: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}/${Number(m)}/${Number(d)}`;
}

export default function DateInput({ value: controlledValue, defaultValue, onChange, name, required, disabled, className }: Props) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const value = isControlled ? controlledValue : internalValue;
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e.target.value);
  }

  function handleClick() {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // showPicker not supported — native click fallback
    }
  }

  return (
    <div
      className={`relative border rounded-lg bg-white ${
        disabled
          ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
          : 'border-slate-300 focus-within:ring-2 focus-within:ring-green-500 cursor-pointer'
      } ${className ?? ''}`}
      onClick={handleClick}
    >
      <div className="px-3 py-2 text-sm pointer-events-none select-none">
        {value
          ? <span className={disabled ? 'text-slate-400' : 'text-slate-800'}>{formatDisplay(value)}</span>
          : <span className="text-slate-300">YYYY/M/D</span>
        }
      </div>
      <input
        ref={inputRef}
        type="date"
        name={name}
        value={isControlled ? value : undefined}
        defaultValue={!isControlled ? defaultValue : undefined}
        onChange={handleChange}
        required={required}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}

