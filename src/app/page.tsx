import { getRecommendations } from '@/lib/calculator';
import OrderBoard from '@/components/OrderBoard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const recommendations = await getRecommendations();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">今日の発注確認</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          過去7日間の売上から自動計算しています。数量を調整して発注してください。
        </p>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">商品が登録されていません</p>
          <p className="text-sm mt-1">商品管理から商品を追加してください</p>
        </div>
      ) : (
        <OrderBoard recommendations={recommendations} />
      )}
    </div>
  );
}
