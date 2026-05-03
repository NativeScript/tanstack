import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'solid-js',
  },
  resolve: {
    // Force solid-js / solid-router to resolve to their browser/dev builds
    // rather than their SSR builds when running tests, even though some specs
    // run under the `node` environment. Tests that exercise actual rendering
    // also opt into `// @vitest-environment jsdom` per-file.
    conditions: ['development', 'browser', 'import', 'default'],
  },
  ssr: {
    // Vitest evaluates test files via Vite's SSR pipeline, which uses SSR
    // resolve conditions and pulls solid-js/web's `server.js` build. That
    // build throws "Client-only API called on the server side" when
    // @tanstack/solid-router internals (CatchBoundary etc.) load. Force
    // these packages through Vite's web (non-SSR) transformer instead.
    noExternal: ['solid-js', '@tanstack/solid-router', '@tanstack/router-core'],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
