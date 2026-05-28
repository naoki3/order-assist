import Link from 'next/link';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import SettingsForm from '@/components/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);

  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: warehousesData }, { data: profileData }] = await Promise.all([
    supabase.from('warehouses').select('id, name').order('name'),
    user
      ? supabase.from('user_profiles').select('warehouse_id').eq('auth_user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const warehouses = (warehousesData ?? []) as { id: number; name: string }[];
  const defaultWarehouseId = (profileData as { warehouse_id: number | null } | null)?.warehouse_id ?? null;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('settings.title', lang)}</h1>
      <SettingsForm warehouses={warehouses} defaultWarehouseId={defaultWarehouseId} />
      <div className="mt-6">
        <Link
          href="/settings/permissions"
          className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-medium border border-green-200 rounded-lg px-4 py-2 hover:bg-green-50 transition-colors"
        >
          {t('nav.permissions', lang)} →
        </Link>
      </div>
    </div>
  );
}
