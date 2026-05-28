/**
 * 出荷フロー — コア体験の通しテスト
 * 出荷予定作成 → 引当 → 出荷確定 → 売上ページに反映
 */
import { test, expect } from '@playwright/test';
import {
  createTestProduct, deleteTestProduct,
  createTestWarehouse, deleteTestWarehouse,
  deleteTestShipmentsByWarehouse,
  seedInventory,
} from '../helpers/db';

const UNIQUE = `E2E_OUT_${Date.now()}`;
let productId: number, productName: string;
let warehouseId: number, warehouseName: string;

test.beforeAll(async () => {
  productName  = `出荷商品_${UNIQUE}`;
  warehouseName = `出荷倉庫_${UNIQUE}`;
  const [p, w] = await Promise.all([
    createTestProduct(productName, 2000),
    createTestWarehouse(warehouseName),
  ]);
  productId = p.id; warehouseId = w.id;
  await seedInventory(productId, warehouseId, 50);
});

test.afterAll(async () => {
  await deleteTestShipmentsByWarehouse(warehouseId);
  await Promise.all([deleteTestProduct(productId), deleteTestWarehouse(warehouseId)]);
});

test('出荷フロー通し — 予定作成 → 引当 → 確定 → 売上反映', async ({ page }) => {
  // 1. 出荷予定を作成
  await page.goto('/shipping/schedule');
  await page.getByRole('button', { name: /伝票作成|新規|追加/i }).click();
  await page.locator('select[name="warehouse_id"]').first().selectOption({ label: warehouseName });
  await page.locator('select[name="product_id"]').first().selectOption({ label: productName });
  await page.locator('input[name="quantity"]').first().fill('10');
  await page.getByRole('button', { name: /作成|保存|追加/i }).click();
  await expect(page.getByText(productName)).toBeVisible({ timeout: 15_000 });

  // 2. 出荷確認ページで引当
  await page.goto('/shipping/confirm');
  const card = page.locator('div, section').filter({ hasText: productName }).first();
  await expect(card).toBeVisible({ timeout: 10_000 });

  const allocateBtn = card.getByRole('button', { name: /引当|allocat/i }).first();
  if (await allocateBtn.isVisible()) {
    await allocateBtn.click();
    await expect(card.getByText(/ロット|lot/i)).toBeVisible({ timeout: 15_000 });
  }

  // 3. 出荷確定
  const confirmBtn = card.getByRole('button', { name: /出荷確定|confirm|確定/i }).first();
  if (await confirmBtn.isVisible()) {
    await confirmBtn.click();
    await page.waitForTimeout(2000);
  }

  // 4. 売上ページに今日の出荷が反映される
  await page.goto('/sales');
  await expect(page.getByText(productName)).toBeVisible({ timeout: 10_000 });

  // 5. 出荷履歴にも反映される
  await page.goto('/shipping/history');
  await expect(page.getByText(productName)).toBeVisible({ timeout: 10_000 });
});
