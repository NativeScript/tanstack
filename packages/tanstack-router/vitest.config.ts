import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  resolve: {
    // Solid 2 packages map the `node` condition to their SSR builds, which render
    // once and never update. Resolve the browser builds even for `node` specs;
    // rendering specs also opt into `// @vitest-environment jsdom`.
    conditions: ['development', 'browser', 'import', 'default'],
  },
  ssr: {
    // Vitest evaluates specs through Vite's SSR pipeline, whose externalized deps
    // resolve with Node conditions. Inline the Solid runtime and the router so
    // they go through the browser resolution above.
    noExternal: ['solid-js', '@solidjs/signals', '@solidjs/web', '@solidjs/universal', '@tanstack/solid-router', '@tanstack/router-core'],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
