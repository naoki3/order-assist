import { requireAdmin } from '@/lib/auth-guard';
import ChatClient from '@/components/ChatClient';

export const dynamic = 'force-dynamic';

export default async function AiChatPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">チャット検索</h1>
      <p className="text-sm text-slate-500 mb-5">自然な言葉で在庫・出荷・入荷状況を検索できます</p>
      <ChatClient />
    </div>
  );
}
