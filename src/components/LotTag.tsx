interface LotTagProps {
  lotNumber: string;
  expiryDate?: string | null;
  today?: string;        // YYYY-MM-DD; enables color-coding
  expiryLabel?: string;  // defaults to '期限'
}

export default function LotTag({ lotNumber, expiryDate, today, expiryLabel = '期限' }: LotTagProps) {
  let expiryTextClass = 'text-slate-400';
  let expirySuffix = '';

  if (expiryDate && today) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    const warnDate = d.toISOString().split('T')[0];
    if (expiryDate < today) {
      expiryTextClass = 'text-red-600 font-medium';
      expirySuffix = ' ⚠';
    } else if (expiryDate <= warnDate) {
      expiryTextClass = 'text-orange-500 font-medium';
      expirySuffix = ' !';
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-bold text-green-700 border border-green-600 px-1 leading-4 rounded tracking-widest shrink-0">
          LOT
        </span>
        <span className="font-mono text-sm font-medium text-slate-800">{lotNumber}</span>
      </div>
      {expiryDate && (
        <p className={`text-xs pl-0.5 ${expiryTextClass}`}>
          {expiryLabel} {expiryDate}{expirySuffix}
        </p>
      )}
    </div>
  );
}
