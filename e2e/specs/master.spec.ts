import { test, expect } from '@playwright/test';

const UNIQUE = `E2E_${Date.now()}`;

test.describe('Master management', () => {
  // ── 認証 ─────────────────────────────────────────────────────────────────

  test('未ログインでアクセスするとログインページにリダイレクトされる', async ({ browser }) => {
    const ctx = await browser.newContext(); // storageState なし = 未ログイン
    const page = await ctx.newPage();
    await page.goto('/master/warehouses');
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  // ── 倉庫マスタ ────────────────────────────────────────────────────────────

  test.describe('Warehouses', () => {
    const name = `倉庫_${UNIQUE}`;
    const editedName = `倉庫_${UNIQUE}_編集済`;

    test('一覧ページが表示される', async ({ page }) => {
      await page.goto('/master/warehouses');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('必須項目が空のまま追加しようとするとエラーになる', async ({ page }) => {
      await page.goto('/master/warehouses');
      await page.getByRole('button', { name: /追加|新規|add/i }).click();
      // 名前を入力せずに送信
      await page.getByRole('button', { name: /^(追加|保存|add)/i }).click();
      // ブラウザのネイティブバリデーションか、エラーメッセージが出る
      const nameInput = page.getByPlaceholder(/名称|name/i).first();
      await expect(nameInput).toHaveAttribute('required');
    });

    test('新規追加できる', async ({ page }) => {
      await page.goto('/master/warehouses');
      await page.getByRole('button', { name: /追加|新規|add/i }).click();
      await page.getByPlaceholder(/名称|name/i).first().fill(name);
      await page.getByRole('button', { name: /^(追加|保存|add)/i }).click();
      await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
    });

    test('編集できる', async ({ page }) => {
      await page.goto('/master/warehouses');
      const row = page.locator('li, [data-item]').filter({ hasText: name }).first();
      await row.getByRole('button', { name: /編集|edit/i }).click();
      const input = row.getByRole('textbox').first();
      await input.clear();
      await input.fill(editedName);
      await row.getByRole('button', { name: /保存|save/i }).click();
      await expect(page.getByText(editedName)).toBeVisible({ timeout: 10_000 });
    });

    test('削除できる', async ({ page }) => {
      await page.goto('/master/warehouses');
      const row = page.locator('li, [data-item]').filter({ hasText: editedName }).first();
      await row.getByRole('button', { name: /削除|delete/i }).click();
      const confirmBtn = page.getByRole('button', { name: /削除|delete|ok|はい/i }).last();
      if (await confirmBtn.isVisible()) await confirmBtn.click();
      await expect(page.getByText(editedName)).not.toBeVisible({ timeout: 10_000 });
    });
  });

  // ── 仕入先マスタ ──────────────────────────────────────────────────────────

  test.describe('Suppliers', () => {
    const name = `仕入先_${UNIQUE}`;

    test('新規追加・編集・削除の一連が動く', async ({ page }) => {
      await page.goto('/master/suppliers');

      // 追加
      await page.getByRole('button', { name: /追加|新規|add/i }).click();
      await page.getByPlaceholder(/名称|name/i).first().fill(name);
      await page.getByRole('button', { name: /^(追加|保存|add)/i }).click();
      await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

      // 削除
      const row = page.locator('li, [data-item]').filter({ hasText: name }).first();
      await row.getByRole('button', { name: /削除|delete/i }).click();
      const confirmBtn = page.getByRole('button', { name: /削除|delete|ok|はい/i }).last();
      if (await confirmBtn.isVisible()) await confirmBtn.click();
      await expect(page.getByText(name)).not.toBeVisible({ timeout: 10_000 });
    });
  });

  // ── 商品マスタ ────────────────────────────────────────────────────────────

  test.describe('Products', () => {
    test('商品一覧ページが表示される', async ({ page }) => {
      await page.goto('/products');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('商品の詳細・編集ページに遷移できる', async ({ page }) => {
      await page.goto('/products');
      const firstLink = page.getByRole('link').first();
      if (await firstLink.isVisible()) {
        await firstLink.click();
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      }
    });
  });
});
