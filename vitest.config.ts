import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [angular(), tsConfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
