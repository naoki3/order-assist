import Link from 'next/link';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import SettingsForm from '@/components/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const lang = await getLang();
  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('settings.title', lang)}</h1>
      <SettingsForm />
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
