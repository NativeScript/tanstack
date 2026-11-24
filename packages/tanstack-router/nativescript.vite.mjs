import { fileURLToPath } from 'node:url';

const solidWebShimPath = fileURLToPath(new URL('./solid-web-shim.js', import.meta.url));

export default () => ({
  resolve: {
    alias: [
      // Anchored: `@solidjs/web/*` subpaths (server-functions, storage) are
      // renderer-independent and must keep resolving to the real package.
      { find: /^@solidjs\/web$/, replacement: solidWebShimPath },
    ],
  },
});
