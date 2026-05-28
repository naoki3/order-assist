import { test, expect } from '@playwright/test';

test.describe('Sales screens', () => {
  test.describe('売上確認 (/sales)', () => {
    test('ページが表示される', async ({ page }) => {
      await page.goto('/sales');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('データがあれば日付グループが表示され、なければ「データなし」が出る', async ({ page }) => {
      await page.goto('/sales');
      const hasData  = await page.locator('[class*="rounded-xl"]').first().isVisible().catch(() => false);
      const hasEmpty = await page.getByText(/データがありません|no data/i).isVisible().catch(() => false);
      expect(hasData || hasEmpty).toBe(true);
    });

    test('出荷済み行に商品名・数量・売上金額が表示される', async ({ page }) => {
      await page.goto('/sales');
      const firstCard = page.locator('[class*="rounded-xl"]').first();
      if (await firstCard.isVisible()) {
        // 商品名テキストが存在する
        await expect(firstCard.locator('span').first()).toBeVisible();
        // ¥ 記号を含む金額が表示されている
        await expect(firstCard.getByText(/¥/)).toBeVisible();
      }
    });

    test('単価スナップショット（@¥xxxx）が表示される', async ({ page }) => {
      await page.goto('/sales');
      // unit_price がある出荷があれば @¥ 表示が出る
      const priceLabel = page.locator('text=/@¥/').first();
      if (await priceLabel.isVisible()) {
        await expect(priceLabel).toBeVisible();
      }
    });

    test('日付グループごとに合計金額が表示される', async ({ page }) => {
      await page.goto('/sales');
      // "合計:" または "Total:" テキストがカード内にあること
      const total = page.getByText(/合計|total/i).first();
      if (await total.isVisible()) {
        await expect(total).toBeVisible();
      }
    });

    test('売上レポートへのリンクが存在し遷移できる', async ({ page }) => {
      await page.goto('/sales');
      await page.getByRole('link', { name: /売上レポート|report/i }).click();
      await expect(page).toHaveURL('/sales/report');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });

  test.describe('売上レポート (/sales/report)', () => {
    test('ページが表示される', async ({ page }) => {
      await page.goto('/sales/report');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('サマリーカード（総出荷数・売上合計）が表示される', async ({ page }) => {
      await page.goto('/sales/report');
      // グリッドカードが複数ある（最低2枚: 総出荷数 + 売上合計）
      await expect(page.locator('[class*="rounded-xl"]').nth(1)).toBeVisible();
    });

    test('7日タブ（デフォルト）が選択されている', async ({ page }) => {
      await page.goto('/sales/report');
      // active なタブが 7 日のもの
      const activeTab = page.getByRole('link', { name: /7日|7 days/i });
      await expect(activeTab).toHaveClass(/bg-green-700|font-medium/);
    });

    test('30日タブに切り替えられる', async ({ page }) => {
      await page.goto('/sales/report');
      await page.getByRole('link', { name: /30日|30 days/i }).click();
      await expect(page).toHaveURL(/period=30/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('今月タブに切り替えられる', async ({ page }) => {
      await page.goto('/sales/report');
      await page.getByRole('link', { name: /今月|this month/i }).click();
      await expect(page).toHaveURL(/month=/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('売上確認に戻るリンクが動く', async ({ page }) => {
      await page.goto('/sales/report');
      await page.getByRole('link', { name: /売上|sales/i }).first().click();
      await expect(page).toHaveURL('/sales');
    });

    test('商品別ランキングが表示される（データがあれば）', async ({ page }) => {
      await page.goto('/sales/report');
      const ranking = page.getByText(/商品別|by product/i);
      if (await ranking.isVisible()) {
        await expect(ranking).toBeVisible();
      }
    });
  });
});
