/**
 * マスタ管理のスモークテスト
 * CRUD が一通り動くことだけ確認する（細かい表示差分は対象外）
 */
import { test, expect } from '@playwright/test';

const UNIQUE = `E2E_${Date.now()}`;

test.describe('Master management', () => {
  test('倉庫マスタ — 追加・編集・削除が通る', async ({ page }) => {
    const name   = `倉庫_${UNIQUE}`;
    const edited = `倉庫_${UNIQUE}_編集`;

    await page.goto('/master/warehouses');

    // 追加
    await page.getByRole('button', { name: /追加|新規|add/i }).click();
    await page.getByPlaceholder(/名称|name/i).first().fill(name);
    await page.getByRole('button', { name: /^(追加|保存|add)/i }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

    // 編集
    const row = page.locator('li, [data-item]').filter({ hasText: name }).first();
    await row.getByRole('button', { name: /編集|edit/i }).click();
    await row.getByRole('textbox').first().fill(edited);
    await row.getByRole('button', { name: /保存|save/i }).click();
    await expect(page.getByText(edited)).toBeVisible({ timeout: 10_000 });

    // 削除
    const editedRow = page.locator('li, [data-item]').filter({ hasText: edited }).first();
    await editedRow.getByRole('button', { name: /削除|delete/i }).click();
    const confirmBtn = page.getByRole('button', { name: /削除|delete|ok|はい/i }).last();
    if (await confirmBtn.isVisible()) await confirmBtn.click();
    await expect(page.getByText(edited)).not.toBeVisible({ timeout: 10_000 });
  });

  test('商品ページが表示される', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
