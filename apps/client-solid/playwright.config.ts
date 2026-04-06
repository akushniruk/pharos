import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * E2E against the **built** Vite app (static preview). No Pharos daemon — hermetic UI shell only.
 * Tauri / packaged builds: future slice (WebDriver or manual QA); see docs/e2e-testing.md.
 */
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 1 : undefined,
  timeout: 60_000,
  reporter: isCi
    ? [
        ['github'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
      ]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: isCi ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: isCi ? 'retain-on-failure' : 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
    timeout: 120_000,
  },
});
