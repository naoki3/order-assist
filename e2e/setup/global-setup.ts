import { chromium, type FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:3000';
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  await page.fill('input[name="identifier"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');

  // Wait for redirect away from login page
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });

  await page.context().storageState({ path: 'e2e/setup/auth.json' });
  await browser.close();
}
