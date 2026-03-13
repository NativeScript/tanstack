import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

const require = createRequire(import.meta.url);
const projectRoot = process.cwd();

let solidJsRuntimePath;
let solidJsHPath;
const solidWebShimPath = fileURLToPath(new URL('./solid-web-shim.js', import.meta.url));
const jsxRuntimeShimPath = fileURLToPath(new URL('./solid-js-jsx-runtime-shim.js', import.meta.url));
const tsrConfigPath = join(projectRoot, 'tsr.config.json');
const defaultRoutesDirectory = join(projectRoot, 'src', 'routes');

function hasFileBasedRoutingConfig() {
  return existsSync(tsrConfigPath) || existsSync(defaultRoutesDirectory);
}

function forcePreEnforce(plugin) {
  if (!plugin || typeof plugin !== 'object') {
    return plugin;
  }

  if (Array.isArray(plugin)) {
    return plugin.map(forcePreEnforce);
  }

  return {
    ...plugin,
    enforce: plugin.enforce ?? 'pre',
  };
}

function getRouterPlugins() {
  if (!hasFileBasedRoutingConfig()) {
    return [];
  }

  const plugin = tanstackRouter({
    // with other frameworks, we can embed different configs
    target: 'solid',
    autoCodeSplitting: false,
    verboseFileRoutes: false,
    enableRouteGeneration: true,
  });

  const normalized = forcePreEnforce(plugin);
  return Array.isArray(normalized) ? normalized : [normalized];
}

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
  plugins: [...getRouterPlugins()],
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
