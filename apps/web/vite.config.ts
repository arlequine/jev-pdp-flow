import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const api = process.env.API_URL ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@jev/contracts': fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url)) },
  },
  server: { proxy: { '/api': api } },
  preview: { proxy: { '/api': api } },
});
