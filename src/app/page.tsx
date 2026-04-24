import { getRecommendations } from '@/lib/calculator';
import OrderBoard from '@/components/OrderBoard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const recommendations = await getRecommendations();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">Today&apos;s Order Review</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Auto-calculated from the past 7 days of sales. Adjust quantities and place your order.
        </p>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">No products registered</p>
          <p className="text-sm mt-1">Add products from the Products page</p>
        </div>
      ) : (
        <OrderBoard recommendations={recommendations} />
      )}
    </div>
  );
}
