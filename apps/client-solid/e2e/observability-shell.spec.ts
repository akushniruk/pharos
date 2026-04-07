import { expect, test } from '@playwright/test';

/**
 * Hermetic preview (no daemon). Covers observability shell UX:
 * empty workspace when no stream, status surface, and navigation back from docs.
 * Session rows / live event ingestion need a mock daemon or fixture WebSocket (future).
 */
test.describe('observability shell (no daemon)', () => {
  test('overview shows empty workspace, search, and zero events in status bar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByPlaceholder('Search projects...')).toBeVisible();
    await expect(page.getByText('No projects have been captured yet.')).toBeVisible();
    await expect(page.locator('.app-statusbar')).toContainText('0 events');
  });

  test('daemon guidance appears when stream has not populated projects', async ({ page }) => {
    await page.goto('/');
    await expect(async () => {
      const hint = page.getByText(/Start the daemon|Waiting for the daemon/);
      await expect(hint).toBeVisible();
    }).toPass({ timeout: 20_000 });
  });

  test('documentation route and home navigation preserve overview shell', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open documentation' }).click();
    await expect(page).toHaveTitle(/Docs ·/);
    await page.getByTitle('Go to home dashboard').click();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page).toHaveTitle(/Home ·/);
  });
});
