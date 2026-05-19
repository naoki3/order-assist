import type { Metadata } from 'next';
import './globals.css';
import { createClient } from '@/lib/supabase';
import { getLang, getTz } from '@/lib/lang';
import Sidebar from '@/components/Sidebar';
import { LanguageProvider } from '@/components/LanguageProvider';

export const metadata: Metadata = {
  title: 'Order Assist',
  description: 'Automatic order quantity calculator',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [lang, tz] = await Promise.all([getLang(), getTz()]);

  return (
    <html lang={lang} className="h-full">
      <body className="min-h-full bg-slate-50">
        <LanguageProvider initialLang={lang} initialTz={tz}>
          {user && <Sidebar />}
          <div className={user ? 'md:ml-56' : ''}>
            <main className="max-w-3xl mx-auto w-full px-4 md:px-8 py-6">
              {children}
            </main>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
