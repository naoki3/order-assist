interface LotTagProps {
  lotNumber: string;
  expiryDate?: string | null;
  today?: string;        // YYYY-MM-DD; enables color-coding
  expiryLabel?: string;  // defaults to '期限'
}

export default function LotTag({ lotNumber, expiryDate, today, expiryLabel = '期限' }: LotTagProps) {
  let expiryClass = 'bg-slate-100 text-slate-500';
  let expirySuffix = '';

  if (expiryDate && today) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    const warnDate = d.toISOString().split('T')[0];
    if (expiryDate < today) {
      expiryClass = 'bg-red-100 text-red-700 font-medium';
      expirySuffix = ' ⚠';
    } else if (expiryDate <= warnDate) {
      expiryClass = 'bg-orange-100 text-orange-600 font-medium';
      expirySuffix = ' !';
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded tracking-wide shrink-0">
        LOT
      </span>
      <span className="font-mono text-slate-700">{lotNumber}</span>
      {expiryDate && (
        <span className={`text-xs px-1.5 py-0.5 rounded ${expiryClass}`}>
          {expiryLabel} {expiryDate}{expirySuffix}
        </span>
      )}
    </div>
  );
}
