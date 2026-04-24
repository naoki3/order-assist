import type { Metadata } from 'next';
import './globals.css';
import { createClient } from '@/lib/supabase';
import NavBar from '@/components/NavBar';

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
        {user && <NavBar />}
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
