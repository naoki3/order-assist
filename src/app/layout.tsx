import type { Metadata } from 'next';
import './globals.css';
import { createClient } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Order Assist',
  description: 'Automatic order quantity calculator',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-50">
        {user && <Sidebar />}
        <div className={user ? 'md:ml-56' : ''}>
          <main className="max-w-3xl mx-auto w-full px-4 md:px-8 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
