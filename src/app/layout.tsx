import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { createClient } from '@/lib/supabase';
import { logout } from '@/app/actions/auth';

export const metadata: Metadata = {
  title: 'Order Assist',
  description: 'Automatic order quantity calculator',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50">
        {user && (
          <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                <span className="font-bold text-lg text-slate-800">Order Assist</span>
                <form action={logout}>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    Logout
                  </button>
                </form>
              </div>
              <nav className="flex gap-0.5 text-sm overflow-x-auto px-3 py-1.5 scrollbar-none">
                <Link href="/" className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                  Order Review
                </Link>
                <Link href="/dashboard" className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                  Dashboard
                </Link>
                <Link href="/sales" className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                  Sales Entry
                </Link>
                <Link href="/products" className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                  Products
                </Link>
                <Link href="/incoming" className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                  Incoming Stock
                </Link>
                <Link href="/history" className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                  Order History
                </Link>
              </nav>
            </div>
          </header>
        )}
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
