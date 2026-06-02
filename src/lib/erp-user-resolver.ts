import { createAdminClient } from '@/lib/supabase-admin';

export interface PerformedBy {
  source_system: string;
  source_user_id: string;
  email: string;
}

export async function resolvePerformedBy(
  performedBy: PerformedBy
): Promise<{ wms_user_id: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('[erp-user-resolver] listUsers error:', error.message);
    return null;
  }
  const user = data.users.find((u) => u.email === performedBy.email);
  if (!user) return null;
  return { wms_user_id: user.id };
}
