import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase';

async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data: membership } = await supabase
    .from('tenant_members')
    .select('owner_id')
    .eq('member_id', userId)
    .maybeSingle();

  if (!membership) return true; // owner

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', userId)
    .maybeSingle();

  return profile?.role === 'admin';
}

// For Server Components / pages — throws notFound() on failure
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  if (!(await isAdmin(supabase, user.id))) notFound();
}

// For API Routes — returns false on failure (caller should return 403)
export async function checkAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return isAdmin(supabase, user.id);
}
