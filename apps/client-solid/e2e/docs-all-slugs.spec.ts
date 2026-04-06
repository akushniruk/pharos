import { expect, test } from '@playwright/test';

import { ALL_DOC_ROUTE_SLUGS } from '../src/features/docs-portal/slugRoutes';

test.describe('docs portal — all slugs', () => {
  for (const slug of ALL_DOC_ROUTE_SLUGS) {
    test(`loads /docs/${slug}`, async ({ page }) => {
      const response = await page.goto(`/docs/${slug}`);
      expect(response?.ok(), `HTTP ${response?.status()} for /docs/${slug}`).toBeTruthy();
      await expect(page).toHaveTitle(/Docs ·/);
      await expect(page.locator('.docs-sidebar-title')).toHaveText('Pharos Docs');
      await expect(page.locator('.docs-portal-empty')).toHaveCount(0);
    });
  }
});
