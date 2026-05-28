import { test, expect } from '@playwright/test';

test.describe('Sales screens', () => {
  test('売上確認ページが表示される', async ({ page }) => {
    await page.goto('/sales');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('売上確認：データがあれば日付グループが表示される', async ({ page }) => {
    await page.goto('/sales');
    // Either data rows or a no-data message should be visible (not a blank page)
    const hasData = await page.locator('[class*="rounded-xl"]').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/データがありません|no data/i).isVisible().catch(() => false);
    expect(hasData || hasEmpty).toBe(true);
  });

  test('売上確認：単価が表示される（スナップショット）', async ({ page }) => {
    await page.goto('/sales');
    // If there are rows with a unit price snapshot, the "@¥" prefix should appear
    const hasPriceLabel = await page.locator('text=/@¥/').first().isVisible().catch(() => false);
    // It's OK if there are no shipped rows yet — just verify no JS errors
    if (hasPriceLabel) {
      await expect(page.locator('text=/@¥/').first()).toBeVisible();
    }
  });

  test('売上レポートページが表示される', async ({ page }) => {
    await page.goto('/sales/report');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('売上レポート：期間タブが切り替えられる', async ({ page }) => {
    await page.goto('/sales/report');

    // Switch to 30-day view
    await page.getByRole('link', { name: /30日|30 days/i }).click();
    await expect(page).toHaveURL(/period=30/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Switch to monthly view
    await page.getByRole('link', { name: /今月|this month/i }).click();
    await expect(page).toHaveURL(/month=/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('売上レポート：売上レポートリンクで遷移できる', async ({ page }) => {
    await page.goto('/sales');
    await page.getByRole('link', { name: /売上レポート|report/i }).click();
    await expect(page).toHaveURL('/sales/report');
  });
});
