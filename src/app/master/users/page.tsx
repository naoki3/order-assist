import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import UserMasterClient from './UserMasterClient';

export const dynamic = 'force-dynamic';

interface AuthUser {
  id: string;
  email: string | undefined;
  created_at: string;
}

export default async function UsersPage() {
  const lang = await getLang();

  let users: AuthUser[] = [];
  let adminError: string | null = null;

  try {
    const { createAdminClient } = await import('@/lib/supabase-admin');
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) {
      adminError = error.message;
    } else {
      users = (data.users ?? []).map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
      }));
      users.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  } catch (e) {
    adminError = e instanceof Error ? e.message : 'Admin API unavailable';
  }

  const labels = {
    title: t('user.title', lang),
    email: t('user.email', lang),
    createdAt: t('user.createdAt', lang),
    empty: t('user.empty', lang),
    inviteTitle: t('user.inviteTitle', lang),
    inviteEmail: t('user.inviteEmail', lang),
    invite: t('user.invite', lang),
    inviting: t('user.inviting', lang),
    invited: t('user.invited', lang),
    noAdminKey: t('user.noAdminKey', lang),
    cancel: t('common.cancel', lang),
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{labels.title}</h1>
      {adminError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          {labels.noAdminKey}: {adminError}
        </div>
      ) : (
        <UserMasterClient users={users} labels={labels} />
      )}
    </div>
  );
}
