import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: '発注アシスト',
  description: '自動発注数計算ツール',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="font-bold text-lg text-slate-800">発注アシスト</span>
            <nav className="flex gap-1 text-sm">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                発注確認
              </Link>
              <Link
                href="/sales"
                className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                売上入力
              </Link>
              <Link
                href="/products"
                className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                商品管理
              </Link>
              <Link
                href="/history"
                className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                発注履歴
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
