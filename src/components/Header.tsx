import Link from 'next/link';
import { logout } from '@/app/actions/auth';

interface Props {
  username: string;
  balance: number;
  isAdmin: boolean;
}

export default function Header({ username, balance, isAdmin }: Props) {
  return (
    <header className="bg-green-700 text-white shadow">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-bold tracking-tight">⚽ SoccerBet</Link>
          {isAdmin && (
            <Link href="/admin" className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded font-semibold">
              管理
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-green-200">{username}</p>
            <p className="text-base font-bold">¥{balance.toLocaleString('ja-JP')}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="text-xs text-green-200 hover:text-white underline">
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
