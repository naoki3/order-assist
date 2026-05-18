import { getRecommendations } from '@/lib/calculator';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import OrderBoard from '@/components/OrderBoard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [recommendations, lang] = await Promise.all([getRecommendations(), getLang()]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">{t('home.title', lang)}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t('home.subtitle', lang)}</p>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">{t('home.noProducts', lang)}</p>
          <p className="text-sm mt-1">{t('home.addProducts', lang)}</p>
        </div>
      ) : (
        <OrderBoard recommendations={recommendations} />
      )}
    </div>
  );
}
