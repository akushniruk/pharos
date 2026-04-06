import { expect, test } from '@playwright/test';

import { ALL_DOC_ROUTE_SLUGS } from '../src/features/docs-portal/slugRoutes';

const FIRST_DOCS_SLUG = ALL_DOC_ROUTE_SLUGS[0];
/** Later portal entry — hash routing should resolve the same as `/docs/:slug`. */
const DEEP_DOCS_SLUG = ALL_DOC_ROUTE_SLUGS[ALL_DOC_ROUTE_SLUGS.length - 1];
const HASH_DOCS_SLUGS = Array.from(new Set([FIRST_DOCS_SLUG, DEEP_DOCS_SLUG]));

test.describe('docs portal — hash router `#/docs/*`', () => {
  for (const slug of HASH_DOCS_SLUGS) {
    test(`loads #/docs/${slug}`, async ({ page }) => {
      const response = await page.goto(`/#/docs/${encodeURIComponent(slug)}`);
      expect(response?.ok(), `HTTP ${response?.status()} for #/docs/${slug}`).toBeTruthy();
      await expect(page).toHaveTitle(/Docs ·/);
      await expect(page.locator('.docs-sidebar-title')).toHaveText('Pharos Docs');
      await expect(page.locator('.docs-portal-empty')).toHaveCount(0);
    });
  }
});
