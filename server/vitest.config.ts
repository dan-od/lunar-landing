import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      // Resolve the shared calculator from source so tests need no build step.
      '@moon/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
});
