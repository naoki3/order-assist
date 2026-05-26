import type { Metadata } from 'next';
import './globals.css';
import { createClient } from '@/lib/supabase';
import { getLang, getTz, getCurrency } from '@/lib/lang';
import Sidebar from '@/components/Sidebar';
import { LanguageProvider } from '@/components/LanguageProvider';
import { DEFAULT_ROLE_SECTIONS } from '@/lib/actions';

export const metadata: Metadata = {
  title: 'Order Assist',
  description: 'Automatic order quantity calculator',
};

async function getAllowedSections(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string[] | undefined> {
  const { data: membership } = await supabase
    .from('tenant_members')
    .select('owner_id')
    .eq('member_id', userId)
    .maybeSingle();

  if (!membership) return undefined; // owner → show all

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', userId)
    .maybeSingle();

  const role = profile?.role ?? 'viewer';
  if (role === 'admin') return undefined;

  const { data: perm } = await supabase
    .from('role_permissions')
    .select('sections')
    .eq('user_id', membership.owner_id)
    .eq('role', role)
    .maybeSingle();

  return perm?.sections ?? DEFAULT_ROLE_SECTIONS[role] ?? [];
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [lang, tz, currency] = await Promise.all([getLang(), getTz(), getCurrency()]);

  const allowedSections = user ? await getAllowedSections(supabase, user.id) : undefined;

  return (
    <html lang={lang} className="h-full">
      <body className="min-h-full bg-slate-50">
        <LanguageProvider initialLang={lang} initialTz={tz} initialCurrency={currency}>
          {user && <Sidebar allowedSections={allowedSections} />}
          <div className={user ? 'md:ml-56' : ''}>
            <main className="w-full px-4 md:px-8 py-6">
              {children}
            </main>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
