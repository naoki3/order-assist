import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { addUserProfile, updateUserProfile, deleteUserProfile, importUserProfilesCsv } from '@/lib/actions';
import MasterList, { type MasterRecord } from '@/components/MasterList';
import MasterCsvImport from '@/components/MasterCsvImport';
import UserAccountManager from '@/components/UserAccountManager';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data }, { data: warehousesData }] = await Promise.all([
    supabase.from('user_profiles').select('id, name, role, worker_code, warehouse_id, is_active, email, phone, note, auth_user_id').order('name'),
    supabase.from('warehouses').select('id, name').order('name'),
  ]);
  const items = (data ?? []) as unknown as MasterRecord[];
  const warehouses = (warehousesData ?? []) as { id: number; name: string }[];

  const roleOptions = [
    { value: 'admin', label: t('user.roleAdmin', lang) },
    { value: 'office', label: t('user.roleOffice', lang) },
    { value: 'warehouse', label: t('user.roleWarehouse', lang) },
    { value: 'viewer', label: t('user.roleViewer', lang) },
  ];

  const activeOptions = [
    { value: 'true', label: t('user.activeYes', lang) },
    { value: 'false', label: t('user.activeNo', lang) },
  ];

  const warehouseOptions = [
    { value: '', label: '—' },
    ...warehouses.map((w) => ({ value: String(w.id), label: w.name })),
  ];

  const fields = [
    { key: 'name', label: t('master.name', lang), required: true, placeholder: t('master.namePlaceholder', lang) },
    { key: 'role', label: t('user.role', lang), type: 'select' as const, options: roleOptions, required: true },
    { key: 'worker_code', label: t('user.workerCode', lang), placeholder: t('user.workerCode', lang) },
    { key: 'warehouse_id', label: t('user.warehouseAssigned', lang), type: 'select' as const, options: warehouseOptions },
    { key: 'is_active', label: t('user.isActive', lang), type: 'select' as const, options: activeOptions },
    { key: 'email', label: t('master.email', lang), type: 'email' as const, placeholder: t('master.email', lang) },
    { key: 'phone', label: t('master.phone', lang), type: 'tel' as const, placeholder: t('master.phone', lang) },
    { key: 'note', label: t('master.note', lang), type: 'textarea' as const, placeholder: t('master.note', lang) },
  ];

  const labels = {
    empty: t('user.empty', lang),
    addNew: t('master.addNew', lang),
    add: t('master.add', lang),
    adding: t('master.adding', lang),
    save: t('products.save', lang),
    saving: t('master.saving', lang),
    cancel: t('common.cancel', lang),
    delete: t('products.delete', lang),
    confirmDelete: t('common.confirmQuestion', lang),
    edit: t('master.edit', lang),
  };

  const accountLabels = {
    loginAccount: t('user.loginAccount', lang),
    hasAccount: t('user.hasAccount', lang),
    noAccount: t('user.noAccount', lang),
    createAccount: t('user.createAccount', lang),
    deleteAccount: t('user.deleteAccount', lang),
    loginId: t('user.loginId', lang),
    loginIdPlaceholder: t('user.loginIdPlaceholder', lang),
    accountPassword: t('user.accountPassword', lang),
    confirmDeleteAccount: t('user.confirmDeleteAccount', lang),
    cancel: t('common.cancel', lang),
  };

  // Build a warehouse name lookup for display
  const warehouseNameMap = Object.fromEntries(warehouses.map((w) => [String(w.id), w.name]));

  // Augment items so warehouse_id is shown as warehouse name in the list
  const displayItems = items.map((item) => ({
    ...item,
    _warehouse_label: item.warehouse_id ? (warehouseNameMap[String(item.warehouse_id)] ?? '') : '',
    _role_label: roleOptions.find((r) => r.value === item.role)?.label ?? String(item.role ?? ''),
    _active_label: String(item.is_active) === 'false' ? t('user.activeNo', lang) : t('user.activeYes', lang),
  }));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('user.title', lang)}</h1>
      <MasterList
        items={displayItems}
        fields={fields}
        addAction={addUserProfile}
        updateAction={updateUserProfile}
        deleteAction={deleteUserProfile}
        labels={labels}
      />
      <MasterCsvImport
        action={importUserProfilesCsv}
        formatHeader="name,role,worker_code,warehouse_name,is_active,email,phone,note"
        formatExamples={['田中太郎,warehouse,W001,東京倉庫,true,taro@example.com,080-1234-5678,倉庫担当']}
      />
      <UserAccountManager
        profiles={(data ?? []).map((p: { id: number; name: string; login_id?: string | null; auth_user_id?: string | null }) => ({ id: p.id, name: p.name, login_id: p.login_id ?? null, auth_user_id: p.auth_user_id ?? null }))}
        labels={accountLabels}
      />
    </div>
  );
}
