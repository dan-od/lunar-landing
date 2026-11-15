import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@moon/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // During dev, send API calls to the Express server.
    // "/api" alone is the API tab page, so only proxy paths beneath it.
    proxy: {
      '/api/': 'http://localhost:8080',
      '/v1/': 'http://localhost:8080',
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
