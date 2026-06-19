import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['__tests__/integration/**/*.test.ts'],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@dockwalker/types': path.resolve(__dirname, '../../packages/types/src'),
      '@dockwalker/db': path.resolve(__dirname, '../../packages/db/src'),
    },
  },
});
