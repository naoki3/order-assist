import { requireAdmin } from '@/lib/auth-guard';
import AnomalyClient from '@/components/AnomalyClient';

export const dynamic = 'force-dynamic';

export default async function AnomalyPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">異常検知</h1>
      <p className="text-sm text-slate-500 mb-6">直近30日の需要を過去60日と比較し、急な変動をAIが検知・分析します</p>
      <AnomalyClient />
    </div>
  );
}
