import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('packages/client/src'),
      '@timebox/shared': resolve('packages/shared/src/index.ts'),
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node', clearMocks: true },
});
