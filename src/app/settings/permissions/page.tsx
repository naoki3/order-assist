import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { PERMISSION_SECTIONS, DEFAULT_ROLE_SECTIONS } from '@/lib/permissions';
import { setRolePermissions } from '@/lib/actions';
import RolePermissionsEditor from '@/components/RolePermissionsEditor';

export const dynamic = 'force-dynamic';

const CONFIGURABLE_ROLES = ['office', 'warehouse', 'viewer'] as const;

export default async function PermissionsPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);

  const { data: rows } = await supabase
    .from('role_permissions')
    .select('role, sections');

  const permissionsMap: Record<string, string[]> = {};
  for (const role of CONFIGURABLE_ROLES) {
    const saved = rows?.find((r) => r.role === role);
    permissionsMap[role] = saved ? saved.sections : DEFAULT_ROLE_SECTIONS[role];
  }

  const sectionLabels: Record<string, string> = {
    orders:    t('nav.ordersGroup', lang),
    incoming:  t('nav.incomingGroup', lang),
    inventory: t('nav.inventoryGroup', lang),
    shipping:  t('nav.shippingGroup', lang),
    sales:     t('nav.salesGroup', lang),
    master:    t('nav.masterGroup', lang),
    products:  t('nav.products', lang),
  };

  const roleLabels: Record<string, string> = {
    office:    t('user.roleOffice', lang),
    warehouse: t('user.roleWarehouse', lang),
    viewer:    t('user.roleViewer', lang),
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">{t('permissions.title', lang)}</h1>
      <p className="text-sm text-slate-500 mb-6">{t('permissions.subtitle', lang)}</p>
      <div className="space-y-6">
        {CONFIGURABLE_ROLES.map((role) => (
          <RolePermissionsEditor
            key={role}
            role={role}
            roleLabel={roleLabels[role]}
            sections={[...PERMISSION_SECTIONS]}
            sectionLabels={sectionLabels}
            currentSections={permissionsMap[role]}
            action={setRolePermissions}
            saveLabel={t('products.save', lang)}
            savingLabel={t('master.saving', lang)}
          />
        ))}
      </div>
    </div>
  );
}
