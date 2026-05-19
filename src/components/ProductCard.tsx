'use client';

import { useActionState } from 'react';
import { updateProduct, deleteProduct, updateStock } from '@/lib/actions';
import type { Product } from '@/lib/db';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { formatQty } from '@/lib/units';
import FeeRateInput from './FeeRateInput';

interface Props {
  product: Product;
  currentStock: number;
}

export default function ProductCard({ product, currentStock }: Props) {
  const { t, lang } = useT();
  const [updateState, updateAction] = useActionState(updateProduct, null);
  const [stockState, stockAction] = useActionState(updateStock, null);
  const [deleteState, deleteAction] = useActionState(deleteProduct, null);

  const { successMsg: updateSuccess, errorMsg: updateError } = useActionFeedback(updateState, t('common.updated'));
  const { successMsg: stockSuccess, errorMsg: stockError } = useActionFeedback(stockState, t('common.updated'));
  const { errorMsg: deleteError } = useActionFeedback(deleteState, t('common.deleted'));

  const expiryLocked = currentStock > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      {/* Edit product */}
      <form action={updateAction} className="space-y-3">
        <input type="hidden" name="id" value={product.id} />
        <div className="flex gap-2">
          <input
            type="text"
            name="name"
            defaultValue={product.name}
            required
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder={t('products.namePlaceholder')}
          />
          <button
            type="submit"
            className="px-3 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors"
          >
            {t('products.save')}
          </button>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1 text-slate-600">
            {t('products.leadTime')}
            <input
              type="number"
              name="lead_time_days"
              defaultValue={product.lead_time_days}
              min={1}
              max={30}
              required
              className="w-14 border border-slate-300 rounded px-2 py-1 text-center"
            />
            {t('products.days')}
          </label>
          <label className="flex items-center gap-1 text-slate-600">
            {t('products.safetyStock')}
            <input
              type="number"
              name="safety_stock_days"
              defaultValue={product.safety_stock_days}
              min={1}
              max={14}
              required
              className="w-14 border border-slate-300 rounded px-2 py-1 text-center"
            />
            {t('products.days')}
          </label>
          <label className="flex items-center gap-1 text-slate-600">
            {t('products.unitPrice')}
            <input
              type="number"
              name="price"
              defaultValue={product.price ?? ''}
              min={0}
              step="0.01"
              placeholder={t('products.optional')}
              className="w-24 border border-slate-300 rounded px-2 py-1 text-center"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className={`flex items-center gap-1 ${expiryLocked ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('products.shelfLife')}
            <select
              name="expiry_type"
              defaultValue={product.expiry_type ?? ''}
              disabled={expiryLocked}
              className="border border-slate-300 rounded px-2 py-1 text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">{t('products.expiryTypeNone')}</option>
              <option value="賞味期限">{t('products.expiryTypeBest')}</option>
              <option value="消費期限">{t('products.expiryTypeUse')}</option>
            </select>
          </label>
          <label className={`flex items-center gap-1 ${expiryLocked ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('products.shelfLifeDays')}
            <input
              type="number"
              name="shelf_life_days"
              defaultValue={product.shelf_life_days ?? ''}
              min={1}
              disabled={expiryLocked}
              placeholder={t('products.optional')}
              className="w-20 border border-slate-300 rounded px-2 py-1 text-center disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            {t('products.days')}
          </label>
          {expiryLocked && (
            <span className="text-xs text-slate-400 self-center">{t('products.expiryLocked')}</span>
          )}
        </div>
        <div className="border-t border-slate-100 pt-3 mt-1">
          <p className="text-xs font-semibold text-slate-500 mb-2">{t('products.feeConfig')} <span className="font-normal text-slate-400">{t('products.optionalParens')}</span></p>
          <div className="flex flex-wrap gap-4 text-sm">
            <FeeRateInput name="incoming_fee_per_piece" unitConfig={product} defaultPerPiece={product.incoming_fee_per_piece} label={t('products.incomingFee')} />
            <FeeRateInput name="storage_fee_per_piece" unitConfig={product} defaultPerPiece={product.storage_fee_per_piece} label={t('products.storageFee')} />
            <FeeRateInput name="outgoing_fee_per_piece" unitConfig={product} defaultPerPiece={product.outgoing_fee_per_piece} label={t('products.outgoingFee')} />
          </div>
        </div>
        <div className="border-t border-slate-100 pt-3 mt-1">
          <p className="text-xs font-semibold text-slate-500 mb-2">{t('products.unitConfig')} <span className="font-normal text-slate-400">{t('products.optionalParens')}</span></p>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1 text-slate-600">
              {t('products.piecesPerBall')}
              <input type="number" name="pieces_per_ball" min={1} defaultValue={product.pieces_per_ball ?? ''} placeholder="—" className="w-16 border border-slate-300 rounded px-2 py-1 text-center" />
              {t('products.unitPieces')}
            </label>
            <label className="flex items-center gap-1 text-slate-600">
              {t('products.ballsPerCase')}
              <input type="number" name="balls_per_case" min={1} defaultValue={product.balls_per_case ?? ''} placeholder="—" className="w-16 border border-slate-300 rounded px-2 py-1 text-center" />
              {t('products.unitBalls')}
            </label>
            <label className="flex items-center gap-1 text-slate-600">
              {t('products.casesPerPallet')}
              <input type="number" name="cases_per_pallet" min={1} defaultValue={product.cases_per_pallet ?? ''} placeholder="—" className="w-16 border border-slate-300 rounded px-2 py-1 text-center" />
              {t('products.unitCases')}
            </label>
          </div>
        </div>
        {updateError && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{updateError}</p>
        )}
        {updateSuccess && (
          <p className="text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2">{updateSuccess}</p>
        )}
      </form>

      {/* Stock update + Delete */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        <form action={stockAction} className="flex items-center gap-2 flex-1">
          <input type="hidden" name="product_id" value={product.id} />
          <span className="text-sm text-slate-500">{t('products.currentStock')}</span>
          <input
            type="number"
            name="current_stock"
            defaultValue={currentStock}
            min={0}
            className="w-20 border border-slate-300 rounded px-2 py-1 text-sm text-center"
          />
          {product.pieces_per_ball ? (
            <span className="text-sm text-slate-500">{formatQty(currentStock, product)}</span>
          ) : (
            <span className="text-sm text-slate-500">{t('products.units')}</span>
          )}
          <button
            type="submit"
            className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
          >
            {t('products.update')}
          </button>
        </form>

        <form action={deleteAction}>
          <input type="hidden" name="id" value={product.id} />
          <button
            type="submit"
            className="px-3 py-1 text-red-500 text-sm rounded-lg hover:bg-red-50 transition-colors"
          >
            {t('products.delete')}
          </button>
        </form>
      </div>

      {stockError && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mt-2">{stockError}</p>
      )}
      {stockSuccess && (
        <p className="text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2 mt-2">{stockSuccess}</p>
      )}
      {deleteError && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mt-2">{deleteError}</p>
      )}
    </div>
  );
}
