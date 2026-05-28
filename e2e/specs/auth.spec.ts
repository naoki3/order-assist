import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('ログインできてダッシュボードにリダイレクトされる', async ({ browser }) => {
    const ctx = await browser.newContext(); // storageState なし
    const page = await ctx.newPage();

    await page.goto('/login');
    await page.fill('input[name="identifier"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');

    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    await ctx.close();
  });

  test('未ログインでアクセスするとログインページにリダイレクトされる', async ({ browser }) => {
    const ctx = await browser.newContext(); // storageState なし
    const page = await ctx.newPage();

    await page.goto('/incoming');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await ctx.close();
  });

  test('ログアウトするとログインページに戻る', async ({ page }) => {
    // storageState あり（ログイン済み）
    await page.goto('/');
    const logoutBtn = page.getByRole('button', { name: /ログアウト|logout|sign out/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      // メニューの中にある場合
      await page.getByRole('link', { name: /ログアウト|logout|sign out/i }).click();
    }
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
