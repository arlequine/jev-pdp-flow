import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const alias = {
  '@jev/contracts': fileURLToPath(new URL('./packages/contracts/src/index.ts', import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: 'contract', include: ['apps/api/test/**/*.contract.test.ts'], environment: 'node', env: { API_LATENCY_MS: '0' } },
      },
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['apps/api/test/**/*.test.ts', 'packages/**/test/**/*.test.ts', 'scripts/test/**/*.test.ts'],
          exclude: ['apps/api/test/**/*.contract.test.ts', '**/node_modules/**'],
          environment: 'node',
          env: { API_LATENCY_MS: '0', JEV_MODE: 'replay' },
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: { name: 'web', include: ['apps/web/test/**/*.test.{ts,tsx}'], environment: 'jsdom', passWithNoTests: true },
      },
    ],
  },
});
