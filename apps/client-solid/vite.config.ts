import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5173'),
  },
  test: {
    environment: 'node',
  },
});
