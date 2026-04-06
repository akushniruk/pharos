import { expect, test } from '@playwright/test';

/** First docs nav slug for `docs/README.md` ("Docs Portal Index"). */
const FIRST_DOCS_SLUG = 'docs-portal-index';

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
