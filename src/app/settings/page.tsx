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
    </div>
  );
}
