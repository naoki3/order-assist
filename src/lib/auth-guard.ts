import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // Owners (not in tenant_members as member) always have full access
  const { data: membership } = await supabase
    .from('tenant_members')
    .select('owner_id')
    .eq('member_id', user.id)
    .maybeSingle();

  if (!membership) return; // owner

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') notFound();
}
