import { requireAdmin } from '@/lib/auth-guard';
import { Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ForecastPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center">
        <Sparkles size={28} className="text-violet-500" />
      </div>
      <h1 className="text-xl font-bold text-slate-800">需要予測</h1>
      <p className="text-sm text-slate-500 max-w-xs">
        過去の出荷実績をもとに、将来の需要をAIが予測します。
      </p>
      <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">Coming soon</span>
    </div>
  );
}
