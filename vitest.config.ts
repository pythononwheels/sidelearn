import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Core logic is framework-agnostic and pure, so a plain Vitest setup suffices.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
