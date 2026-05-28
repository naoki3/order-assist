import { test, expect } from '@playwright/test';

const UNIQUE = `E2E_${Date.now()}`;

test.describe('Master management', () => {
  // ── Warehouses ────────────────────────────────────────────────────────────

  test.describe('Warehouses', () => {
    let createdName: string;

    test('shows warehouse list', async ({ page }) => {
      await page.goto('/master/warehouses');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('adds a new warehouse', async ({ page }) => {
      createdName = `倉庫_${UNIQUE}`;
      await page.goto('/master/warehouses');

      // Open add form
      await page.getByRole('button', { name: /追加|新規|add/i }).click();
      await page.getByPlaceholder(/名称|name/i).first().fill(createdName);
      await page.getByRole('button', { name: /^(追加|保存|add)/i }).click();

      // Verify the new warehouse appears in the list
      await expect(page.getByText(createdName)).toBeVisible({ timeout: 10_000 });
    });

    test('deletes the warehouse created above', async ({ page }) => {
      await page.goto('/master/warehouses');
      const row = page.locator('li, [data-item]').filter({ hasText: createdName }).first();
      await row.getByRole('button', { name: /削除|delete/i }).click();
      // Confirm dialog
      const confirmBtn = page.getByRole('button', { name: /削除|delete|ok|はい/i }).last();
      if (await confirmBtn.isVisible()) await confirmBtn.click();
      await expect(page.getByText(createdName)).not.toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Suppliers ─────────────────────────────────────────────────────────────

  test.describe('Suppliers', () => {
    let createdName: string;

    test('shows supplier list', async ({ page }) => {
      await page.goto('/master/suppliers');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('adds a new supplier', async ({ page }) => {
      createdName = `仕入先_${UNIQUE}`;
      await page.goto('/master/suppliers');

      await page.getByRole('button', { name: /追加|新規|add/i }).click();
      await page.getByPlaceholder(/名称|name/i).first().fill(createdName);
      await page.getByRole('button', { name: /^(追加|保存|add)/i }).click();

      await expect(page.getByText(createdName)).toBeVisible({ timeout: 10_000 });
    });

    test('cleans up test supplier', async ({ page }) => {
      await page.goto('/master/suppliers');
      const row = page.locator('li, [data-item]').filter({ hasText: createdName }).first();
      await row.getByRole('button', { name: /削除|delete/i }).click();
      const confirmBtn = page.getByRole('button', { name: /削除|delete|ok|はい/i }).last();
      if (await confirmBtn.isVisible()) await confirmBtn.click();
      await expect(page.getByText(createdName)).not.toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Products ──────────────────────────────────────────────────────────────

  test.describe('Products', () => {
    test('shows products page', async ({ page }) => {
      await page.goto('/products');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });
});
