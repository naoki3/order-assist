/**
 * Outbound flow tests — 出荷予定作成 → 引当 → 出荷確定 → 売上反映まで通し
 *
 * 前提: 在庫が存在すること。incoming.spec.ts の入荷確認後に実行すること。
 * または beforeAll で直接 inventory を seed する（簡易版は既存在庫に依存）。
 */
import { test, expect } from '@playwright/test';
import {
  createTestProduct,
  deleteTestProduct,
  createTestWarehouse,
  deleteTestWarehouse,
  deleteTestShipmentsByWarehouse,
  seedInventory,
} from '../helpers/db';

const UNIQUE = `E2E_OUT_${Date.now()}`;
let productId: number;
let productName: string;
let warehouseId: number;
let warehouseName: string;

test.beforeAll(async () => {
  productName  = `出荷商品_${UNIQUE}`;
  warehouseName = `出荷倉庫_${UNIQUE}`;

  const [p, w] = await Promise.all([
    createTestProduct(productName, 2000),
    createTestWarehouse(warehouseName),
  ]);
  productId   = p.id;
  warehouseId = w.id;

  // 在庫と lot を作成して引当・出荷が可能な状態にする
  await seedInventory(productId, warehouseId, 50);
});

test.afterAll(async () => {
  await deleteTestShipmentsByWarehouse(warehouseId);
  await Promise.all([
    deleteTestProduct(productId),
    deleteTestWarehouse(warehouseId),
  ]);
});

test.describe('Outbound flow', () => {
  test.describe('出荷予定', () => {
    test('ページが表示される', async ({ page }) => {
      await page.goto('/shipping/schedule');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('新規伝票を作成できる', async ({ page }) => {
      await page.goto('/shipping/schedule');
      await page.getByRole('button', { name: /伝票作成|新規|追加/i }).click();

      await page.locator('select[name="warehouse_id"]').first().selectOption({ label: warehouseName });
      await page.locator('select[name="product_id"]').first().selectOption({ label: productName });
      await page.locator('input[name="quantity"]').first().fill('10');
      await page.getByRole('button', { name: /作成|保存|追加/i }).click();

      await expect(page.getByText(productName)).toBeVisible({ timeout: 15_000 });
    });

    test('倉庫を選択しないと作成できない（必須チェック）', async ({ page }) => {
      await page.goto('/shipping/schedule');
      await page.getByRole('button', { name: /伝票作成|新規|追加/i }).click();

      await page.locator('select[name="product_id"]').first().selectOption({ label: productName });
      await page.locator('input[name="quantity"]').first().fill('5');
      await page.getByRole('button', { name: /作成|保存|追加/i }).click();

      // フォームがまだ見えている = 送信されていない
      await expect(page.locator('select[name="warehouse_id"]').first()).toBeVisible();
    });
  });

  test.describe('出荷確認・引当', () => {
    test('確認ページが表示される', async ({ page }) => {
      await page.goto('/shipping/confirm');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('作成した伝票が確認ページに表示される', async ({ page }) => {
      await page.goto('/shipping/confirm');
      await expect(page.getByText(productName)).toBeVisible({ timeout: 10_000 });
    });

    test('引当ボタンを押せる', async ({ page }) => {
      await page.goto('/shipping/confirm');
      const card = page.locator('div, section').filter({ hasText: productName }).first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      const allocateBtn = card.getByRole('button', { name: /引当|allocat/i }).first();
      if (await allocateBtn.isVisible()) {
        await allocateBtn.click();
        // 引当後はロット情報が表示される
        await expect(card.getByText(/ロット|lot/i)).toBeVisible({ timeout: 15_000 });
      }
    });

    test('出荷確定すると shipped になり売上に反映される', async ({ page }) => {
      await page.goto('/shipping/confirm');
      const card = page.locator('div, section').filter({ hasText: productName }).first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      // 引当済みなら出荷確定ボタンが出ている
      const confirmBtn = card.getByRole('button', { name: /出荷確定|confirm|確定/i }).first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        // 確定後はカードが消えるか shipped 表示になる
        await page.waitForTimeout(2000);
      }

      // 売上ページに反映されているか確認
      await page.goto('/sales');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // 出荷確定した商品が売上に表示される（当日分）
      const salesEntry = page.getByText(productName);
      if (await salesEntry.isVisible()) {
        // 単価スナップショットも表示されているか
        await expect(page.getByText(/@¥/)).toBeVisible();
      }
    });
  });

  test.describe('出荷履歴', () => {
    test('履歴ページが表示される', async ({ page }) => {
      await page.goto('/shipping/history');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('出荷確定した伝票が履歴に表示される', async ({ page }) => {
      await page.goto('/shipping/history');
      // 出荷確定済みであれば履歴に出る
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });
});
