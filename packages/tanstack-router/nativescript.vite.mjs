import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

let solidJsRuntimePath;
let solidJsHPath;
const solidWebShimPath = fileURLToPath(new URL('./solid-web-shim.js', import.meta.url));
const jsxRuntimeShimPath = fileURLToPath(new URL('./solid-js-jsx-runtime-shim.js', import.meta.url));

try {
  const solidJsPackagePath = require.resolve('solid-js/package.json');
  const solidJsRoot = dirname(solidJsPackagePath);

  const candidateRuntimePath = join(solidJsRoot, 'h', 'jsx-runtime', 'dist', 'jsx.js');
  const candidateHPath = join(solidJsRoot, 'h', 'dist', 'h.js');

  if (existsSync(candidateRuntimePath)) {
    solidJsRuntimePath = candidateRuntimePath;
  }

  if (existsSync(candidateHPath)) {
    solidJsHPath = candidateHPath;
  }

  if (!solidJsRuntimePath || !solidJsHPath) {
    console.warn(
      '[nativescript/tanstack-router] Could not resolve one or more SolidJS runtime alias paths for Vite.',
      {
        runtimeFound: !!solidJsRuntimePath,
        hFound: !!solidJsHPath,
        solidJsRoot,
      },
    );
  }
} catch (error) {
  console.warn(
    '[nativescript/tanstack-router] Failed to resolve SolidJS package location for Vite aliases.',
    error instanceof Error ? error.message : error,
  );
}

export default () => ({
  resolve: {
    alias: {
      // Keep Vite behavior aligned with nativescript.webpack.js integration.
      'solid-js/web': solidWebShimPath,
      'solid-js/jsx-runtime': jsxRuntimeShimPath,
      'solid-js/jsx-dev-runtime': jsxRuntimeShimPath,
      ...(solidJsHPath
        ? {
            'solid-js/h': solidJsHPath,
          }
        : {}),
    },
  },
});
