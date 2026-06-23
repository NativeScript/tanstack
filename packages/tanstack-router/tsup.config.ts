import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'packages/tanstack-router/src/index.ts',
    'solid/index': 'packages/tanstack-router/src/solid/index.ts',
    'react/index': 'packages/tanstack-router/src/react/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: false,
  target: 'es2018',
  outDir: 'dist/packages/tanstack-router',
  external: ['@tanstack/solid-router', '@tanstack/react-router', '@tanstack/history', '@nativescript/core', '@nativescript/core/abortcontroller', '@nativescript-community/solid-js', '@nativescript-community/react', 'solid-js', 'solid-js/web', 'solid-js/jsx-runtime', 'react', 'react-dom', 'react/jsx-runtime', 'react-reconciler'],
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
