import { expect, test } from '@playwright/test';

import { ALL_DOC_ROUTE_SLUGS } from '../src/features/docs-portal/slugRoutes';

/** First portal slug (same order as `docs-all-slugs` crawl). */
const FIRST_DOCS_SLUG = ALL_DOC_ROUTE_SLUGS[0];

test.describe('static shell', () => {
  test('home shows projects chrome', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Projects', { exact: true })).toBeVisible();
    await expect(page).toHaveTitle(/Home ·/);
  });

  test('docs route renders docs shell', async ({ page }) => {
    await page.goto(`/docs/${FIRST_DOCS_SLUG}`);
    await expect(page).toHaveTitle(/Docs ·/);
    await expect(page.locator('.docs-sidebar-title')).toHaveText('Pharos Docs');
  });
});
