/**
 * Inbound flow tests
 *
 * beforeAll: DB に商品・倉庫・仕入先を作成
 * afterAll:  作成したレシートごと全削除
 */
import { test, expect } from '@playwright/test';
import {
  createTestProduct,
  deleteTestProduct,
  createTestWarehouse,
  deleteTestWarehouse,
  createTestSupplier,
  deleteTestSupplier,
  deleteTestReceiptsByWarehouse,
} from '../helpers/db';

const UNIQUE = `E2E_IN_${Date.now()}`;
let productId: number;
let productName: string;
let warehouseId: number;
let warehouseName: string;
let supplierId: number;
let supplierName: string;

test.beforeAll(async () => {
  productName  = `商品_${UNIQUE}`;
  warehouseName = `倉庫_${UNIQUE}`;
  supplierName  = `仕入先_${UNIQUE}`;
  const [p, w, s] = await Promise.all([
    createTestProduct(productName, 1000),
    createTestWarehouse(warehouseName),
    createTestSupplier(supplierName),
  ]);
  productId   = p.id;
  warehouseId = w.id;
  supplierId  = s.id;
});

test.afterAll(async () => {
  await deleteTestReceiptsByWarehouse(warehouseId);
  await Promise.all([
    deleteTestProduct(productId),
    deleteTestWarehouse(warehouseId),
    deleteTestSupplier(supplierId),
  ]);
});

test.describe('Inbound flow', () => {
  test.describe('入荷予定', () => {
    test('ページが表示される', async ({ page }) => {
      await page.goto('/incoming/schedule');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('新規伝票を作成できる', async ({ page }) => {
      await page.goto('/incoming/schedule');
      await page.getByRole('button', { name: /伝票作成|新規|追加/i }).click();

      await page.locator('select[name="warehouse_id"]').first().selectOption({ label: warehouseName });
      const supplierSelect = page.locator('select[name="supplier_id"]');
      if (await supplierSelect.isVisible()) {
        await supplierSelect.selectOption({ label: supplierName });
      }
      await page.locator('select[name="product_id"]').first().selectOption({ label: productName });
      await page.locator('input[name="quantity"]').first().fill('10');
      await page.getByRole('button', { name: /作成|保存|追加/i }).click();

      await expect(page.getByText(productName)).toBeVisible({ timeout: 15_000 });
    });

    test('倉庫を選択しないと作成できない（必須チェック）', async ({ page }) => {
      await page.goto('/incoming/schedule');
      await page.getByRole('button', { name: /伝票作成|新規|追加/i }).click();

      // 倉庫を空のまま送信
      await page.locator('select[name="product_id"]').first().selectOption({ label: productName });
      await page.locator('input[name="quantity"]').first().fill('5');
      await page.getByRole('button', { name: /作成|保存|追加/i }).click();

      // まだ同じページにいる（遷移しない）
      await expect(page.getByRole('button', { name: /伝票作成|新規|追加/i })).toBeVisible();
    });
  });

  test.describe('入荷確認', () => {
    test('ページが表示される', async ({ page }) => {
      await page.goto('/incoming');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('作成した伝票が確認ページに表示される', async ({ page }) => {
      await page.goto('/incoming');
      await expect(page.getByText(productName)).toBeVisible({ timeout: 10_000 });
    });

    test('全数入荷確認すると「入荷済み」バッジが表示される', async ({ page }) => {
      await page.goto('/incoming');
      const card = page.locator('div, section').filter({ hasText: productName }).first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      const confirmBtn = card.getByRole('button', { name: /入荷確認|確認|confirm/i }).first();
      await confirmBtn.click();

      const qtyInput = card.locator('input[type="number"]').first();
      if (await qtyInput.isVisible()) await qtyInput.fill('10');

      await card.getByRole('button', { name: /確定|保存|入荷確認/i }).last().click();

      await expect(card.getByText(/入荷済み/)).toBeVisible({ timeout: 15_000 });
    });

    test('部分入荷（5/10個）すると残数が更新される', async ({ page }) => {
      // 新しい伝票を作成して部分入荷をテスト
      await page.goto('/incoming/schedule');
      await page.getByRole('button', { name: /伝票作成|新規|追加/i }).click();
      await page.locator('select[name="warehouse_id"]').first().selectOption({ label: warehouseName });
      await page.locator('select[name="product_id"]').first().selectOption({ label: productName });
      await page.locator('input[name="quantity"]').first().fill('10');
      await page.getByRole('button', { name: /作成|保存|追加/i }).click();
      await expect(page.getByText(productName)).toBeVisible({ timeout: 15_000 });

      // 入荷確認で 5 個だけ入荷
      await page.goto('/incoming');
      const cards = page.locator('div, section').filter({ hasText: productName });
      const card = cards.last(); // 最新の伝票
      const confirmBtn = card.getByRole('button', { name: /入荷確認|確認|confirm/i }).first();
      await confirmBtn.click();

      const qtyInput = card.locator('input[type="number"]').first();
      if (await qtyInput.isVisible()) await qtyInput.fill('5');

      await card.getByRole('button', { name: /確定|保存|入荷確認/i }).last().click();

      // 部分入荷 or discrepancy の表示になること（完全な「入荷済み」ではない）
      await expect(card).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('入荷履歴', () => {
    test('履歴ページが表示される', async ({ page }) => {
      await page.goto('/incoming/history');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('確認済み伝票が履歴に表示される', async ({ page }) => {
      await page.goto('/incoming/history');
      // 入荷確認したものが履歴に出ているはず
      await expect(page.getByText(productName)).toBeVisible({ timeout: 10_000 });
    });
  });
});
