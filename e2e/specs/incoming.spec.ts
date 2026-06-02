/**
 * 入荷フロー — コア体験の通しテスト
 * 入荷予定作成 → 入荷確認 → 入荷済みバッジ → 履歴反映
 */
import { test, expect } from '@playwright/test';
import {
  createTestProduct, deleteTestProduct,
  createTestWarehouse, deleteTestWarehouse,
  createTestSupplier, deleteTestSupplier,
  deleteTestReceiptsByWarehouse,
} from '../helpers/db';

const UNIQUE = `E2E_IN_${Date.now()}`;
let productId: number, productName: string;
let warehouseId: number, warehouseName: string;
let supplierId: number, supplierName: string;

test.beforeAll(async () => {
  productName  = `商品_${UNIQUE}`;
  warehouseName = `倉庫_${UNIQUE}`;
  supplierName  = `仕入先_${UNIQUE}`;
  const [p, w, s] = await Promise.all([
    createTestProduct(productName, 1000),
    createTestWarehouse(warehouseName),
    createTestSupplier(supplierName),
  ]);
  productId = p.id; warehouseId = w.id; supplierId = s.id;
});

test.afterAll(async () => {
  await deleteTestReceiptsByWarehouse(warehouseId);
  await Promise.all([
    deleteTestProduct(productId),
    deleteTestWarehouse(warehouseId),
    deleteTestSupplier(supplierId),
  ]);
});

test('入荷フロー通し — 予定作成 → 確認 → 入荷済み → 履歴', async ({ page }) => {
  // 1. 入荷予定を作成
  await page.goto('/incoming/schedule');
  await page.getByRole('button', { name: /伝票作成|新規|追加/i }).click();
  await page.locator('select[name="warehouse_id"]').first().selectOption({ label: warehouseName });
  const supplierSelect = page.locator('select[name="supplier_id"]');
  if (await supplierSelect.isVisible()) await supplierSelect.selectOption({ label: supplierName });
  await page.locator('select[name="product_id"]').first().selectOption({ label: productName });
  await page.locator('input[name="quantity"]').first().fill('10');
  await page.getByRole('button', { name: /作成|保存|追加/i }).click();
  await expect(page.getByText(productName)).toBeVisible({ timeout: 15_000 });

  // 2. 入荷確認で全数入荷
  await page.goto('/incoming');
  const card = page.locator('div, section').filter({ hasText: productName }).first();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByRole('button', { name: /入荷確認|確認|confirm/i }).first().click();
  const qtyInput = card.locator('input[type="number"]').first();
  if (await qtyInput.isVisible()) await qtyInput.fill('10');
  await card.getByRole('button', { name: /確定|保存|入荷確認/i }).last().click();

  // 3. 入荷済みバッジが表示される
  await expect(card.getByText(/入荷済み/)).toBeVisible({ timeout: 15_000 });

  // 4. 入荷履歴に反映される
  await page.goto('/incoming/history');
  await expect(page.getByText(productName)).toBeVisible({ timeout: 10_000 });
});
