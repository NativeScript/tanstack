import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'packages/tanstack-router/src/index.ts',
    'solid/index': 'packages/tanstack-router/src/solid/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: false,
  target: 'es2018',
  outDir: 'dist/packages/tanstack-router',
  external: ['@tanstack/solid-router', '@tanstack/history', '@nativescript/core', '@nativescript/core/abortcontroller', '@nativescript-community/solid-js', 'solid-js', 'solid-js/web', 'solid-js/jsx-runtime'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.jsxImportSource = 'solid-js';
  },
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    };
  },
});
