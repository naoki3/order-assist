/**
 * Inbound flow: create receipt → confirm line → verify received badge
 *
 * Requires test data (product, warehouse, supplier) that is seeded via DB helpers
 * before the suite and cleaned up after.
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

let productId: number;
let productName: string;
let warehouseId: number;
let warehouseName: string;
let supplierId: number;
let supplierName: string;

const UNIQUE = `E2E_${Date.now()}`;

test.beforeAll(async () => {
  productName = `商品_${UNIQUE}`;
  warehouseName = `倉庫_${UNIQUE}`;
  supplierName = `仕入先_${UNIQUE}`;

  const [product, warehouse, supplier] = await Promise.all([
    createTestProduct(productName, 1000),
    createTestWarehouse(warehouseName),
    createTestSupplier(supplierName),
  ]);
  productId = product.id;
  warehouseId = warehouse.id;
  supplierId = supplier.id;
});

test.afterAll(async () => {
  // Delete receipts first (FK constraint), then masters
  await deleteTestReceiptsByWarehouse(warehouseId);
  await Promise.all([
    deleteTestProduct(productId),
    deleteTestWarehouse(warehouseId),
    deleteTestSupplier(supplierId),
  ]);
});

test.describe('Inbound flow', () => {
  test('入荷予定ページが表示される', async ({ page }) => {
    await page.goto('/incoming/schedule');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('入荷予定を新規作成できる', async ({ page }) => {
    await page.goto('/incoming/schedule');

    // Open create form
    await page.getByRole('button', { name: /伝票作成|新規|追加/i }).click();

    // Fill warehouse (required)
    const warehouseSelect = page.locator('select[name="warehouse_id"]').first();
    await warehouseSelect.selectOption({ label: warehouseName });

    // Fill supplier
    const supplierSelect = page.locator('select[name="supplier_id"]');
    if (await supplierSelect.isVisible()) {
      await supplierSelect.selectOption({ label: supplierName });
    }

    // Expected date (default is today, keep as-is)

    // Add a product line
    const productSelect = page.locator('select[name="product_id"]').first();
    await productSelect.selectOption({ label: productName });

    // Quantity
    const qtyInput = page.locator('input[name="quantity"]').first();
    await qtyInput.fill('10');

    // Submit
    await page.getByRole('button', { name: /作成|保存|追加|add/i }).click();

    // Verify receipt appears (look for product name in the list)
    await expect(page.getByText(productName)).toBeVisible({ timeout: 15_000 });
  });

  test('入荷確認ページが表示される', async ({ page }) => {
    await page.goto('/incoming');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('入荷明細を確認（received）にできる', async ({ page }) => {
    await page.goto('/incoming');

    // Find the receipt card containing our product
    const card = page.locator('div, section').filter({ hasText: productName }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Click the confirm / 入荷確認 button on that card
    const confirmBtn = card.getByRole('button', { name: /入荷確認|確認|confirm/i }).first();
    await confirmBtn.click();

    // Fill received_qty if prompted
    const qtyInput = card.locator('input[type="number"]').first();
    if (await qtyInput.isVisible()) {
      await qtyInput.fill('10');
    }

    // Submit confirmation
    const submitBtn = card.getByRole('button', { name: /確定|保存|save|入荷確認/i }).last();
    await submitBtn.click();

    // Verify "入荷済み" badge appears
    await expect(card.getByText(/入荷済み/i)).toBeVisible({ timeout: 15_000 });
  });
});
