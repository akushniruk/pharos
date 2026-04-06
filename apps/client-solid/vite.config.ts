import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { defaultExclude } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Relative asset URLs when built via `tauri build` (TAURI_* set by the Tauri CLI).
  base: process.env.TAURI_ENV_PLATFORM ? './' : '/',
  plugins: [solid()],
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@widgets': path.resolve(__dirname, 'src/widgets'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@entities': path.resolve(__dirname, 'src/entities'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: parseInt(process.env.VITE_PORT || '5173'),
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    hmr: process.env.TAURI_DEV_HOST
      ? { protocol: 'ws', host: process.env.TAURI_DEV_HOST, port: 5173 }
      : undefined,
  },
  test: {
    environment: 'node',
    exclude: [...defaultExclude, '**/e2e/**'],
  },
});
