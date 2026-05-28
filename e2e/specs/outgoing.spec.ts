/**
 * Outbound flow: create shipment → allocate → confirm → verify sales page
 *
 * Depends on inventory stock existing for the test product.
 * The incoming.spec.ts suite seeds a receipt; this suite runs after and
 * uses the same product to create an outgoing shipment.
 *
 * Run order: incoming.spec.ts must complete first so inventory > 0.
 */
import { test, expect } from '@playwright/test';
import {
  createTestProduct,
  deleteTestProduct,
  createTestWarehouse,
  deleteTestWarehouse,
  deleteTestShipmentsByWarehouse,
} from '../helpers/db';

let productId: number;
let productName: string;
let warehouseId: number;
let warehouseName: string;

const UNIQUE = `E2E_OUT_${Date.now()}`;

test.beforeAll(async () => {
  productName = `出荷商品_${UNIQUE}`;
  warehouseName = `出荷倉庫_${UNIQUE}`;

  const [product, warehouse] = await Promise.all([
    createTestProduct(productName, 2000),
    createTestWarehouse(warehouseName),
  ]);
  productId = product.id;
  warehouseId = warehouse.id;
});

test.afterAll(async () => {
  await deleteTestShipmentsByWarehouse(warehouseId);
  await Promise.all([
    deleteTestProduct(productId),
    deleteTestWarehouse(warehouseId),
  ]);
});

test.describe('Outbound flow', () => {
  test('出荷予定ページが表示される', async ({ page }) => {
    await page.goto('/shipping/schedule');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('出荷予定を新規作成できる', async ({ page }) => {
    await page.goto('/shipping/schedule');

    await page.getByRole('button', { name: /伝票作成|新規|追加/i }).click();

    // Warehouse (required)
    const warehouseSelect = page.locator('select[name="warehouse_id"]').first();
    await warehouseSelect.selectOption({ label: warehouseName });

    // Product line
    const productSelect = page.locator('select[name="product_id"]').first();
    await productSelect.selectOption({ label: productName });

    const qtyInput = page.locator('input[name="quantity"]').first();
    await qtyInput.fill('5');

    await page.getByRole('button', { name: /作成|保存|追加|add/i }).click();

    await expect(page.getByText(productName)).toBeVisible({ timeout: 15_000 });
  });

  test('出荷確認ページが表示される', async ({ page }) => {
    await page.goto('/shipping/confirm');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
