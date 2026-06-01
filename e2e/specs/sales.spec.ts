/**
 * 売上・レポート画面のスモークテスト
 * ページが開く、主要なナビゲーションが動く、だけ確認する
 */
import { test, expect } from '@playwright/test';

test.describe('Sales screens', () => {
  test('売上確認ページが表示される', async ({ page }) => {
    await page.goto('/sales');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('売上レポートへ遷移して戻れる', async ({ page }) => {
    await page.goto('/sales');
    await page.getByRole('link', { name: /売上レポート|report/i }).click();
    await expect(page).toHaveURL('/sales/report');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('link', { name: /売上|sales/i }).first().click();
    await expect(page).toHaveURL('/sales');
  });

  test('レポートの期間タブが切り替えられる', async ({ page }) => {
    await page.goto('/sales/report');
    await page.getByRole('link', { name: /30日|30 days/i }).click();
    await expect(page).toHaveURL(/period=30/);

    await page.getByRole('link', { name: /今月|this month/i }).click();
    await expect(page).toHaveURL(/month=/);
  });
});
