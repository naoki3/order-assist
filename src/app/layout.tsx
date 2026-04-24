import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getSession } from '@/lib/session';
import { logout } from '@/app/actions/auth';

export const metadata: Metadata = {
  title: 'Order Assist',
  description: 'Automatic order quantity calculator',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50">
        {session && (
          <header className="bg-white border-b border-slate-200 px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <span className="font-bold text-lg text-slate-800">Order Assist</span>
              <div className="flex items-center gap-2">
                <nav className="flex gap-1 text-sm">
                  <Link
                    href="/"
                    className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    Order Review
                  </Link>
                  <Link
                    href="/sales"
                    className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    Sales Entry
                  </Link>
                  <Link
                    href="/products"
                    className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    Products
                  </Link>
                  <Link
                    href="/incoming"
                    className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    Incoming Stock
                  </Link>
                  <Link
                    href="/history"
                    className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    Order History
                  </Link>
                </nav>
                <form action={logout}>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    Logout
                  </button>
                </form>
              </div>
            </div>
          </header>
        )}
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
