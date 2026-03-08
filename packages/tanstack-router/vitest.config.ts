import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'solid-js',
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
