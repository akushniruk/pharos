import { expect, test } from '@playwright/test';

import { ALL_DOC_ROUTE_SLUGS } from '../src/features/docs-portal/slugRoutes';

/** Stable “deep” slug — not the first nav entry, still a real bundled doc. */
function deepDocsSlug(): string {
  const slugs = ALL_DOC_ROUTE_SLUGS;
  if (slugs.length < 2) return slugs[0] ?? 'docs-portal-index';
  return slugs[Math.min(5, slugs.length - 1)]!;
}

test.describe('hash docs route #/docs/*', () => {
  test('first slug loads via hash', async ({ page }) => {
    const slug = ALL_DOC_ROUTE_SLUGS[0];
    if (!slug) throw new Error('no doc slugs');
    await page.goto(`/#/docs/${encodeURIComponent(slug)}`);
    await expect(page).toHaveTitle(/Docs ·/);
    await expect(page.locator('.docs-sidebar-title')).toHaveText('Pharos Docs');
    await expect(page.locator('.docs-portal-empty')).toHaveCount(0);
  });

  test('deep slug loads via hash', async ({ page }) => {
    const slug = deepDocsSlug();
    await page.goto(`/#/docs/${encodeURIComponent(slug)}`);
    await expect(page).toHaveTitle(/Docs ·/);
    await expect(page.locator('.docs-sidebar-title')).toHaveText('Pharos Docs');
    await expect(page.locator('.docs-portal-empty')).toHaveCount(0);
  });
});
