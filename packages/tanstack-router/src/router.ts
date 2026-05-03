import { createRouter, type AnyRoute } from '@tanstack/solid-router';
import { AbortController as NativeScriptAbortController, AbortSignal as NativeScriptAbortSignal } from '@nativescript/core/abortcontroller';
import { createNativeScriptHistory } from './history';

// NativeScript polyfills — TanStack Router requires these globals.
// Runs at module load time, after imports resolve but before any router is created.
if (typeof self === 'undefined') {
  (globalThis as any).self = globalThis;
}
if (typeof AbortController === 'undefined') {
  (globalThis as any).AbortController = NativeScriptAbortController;
  (globalThis as any).AbortSignal = NativeScriptAbortSignal;
}

type RouterOptions<TRouteTree extends AnyRoute> = Parameters<typeof createRouter<TRouteTree>>[0];

export function createNativeScriptRouter<TRouteTree extends AnyRoute>(
  opts: Omit<RouterOptions<TRouteTree>, 'history'> & {
    initialPath?: string;
  },
) {
  const { initialPath, ...routerOpts } = opts;
  const router = createRouter<TRouteTree>({
    ...(routerOpts as RouterOptions<TRouteTree>),
    history: createNativeScriptHistory({ initialPath }),
  });
  // Dev-only: expose router for HMR client to patch route loaders
  // when non-component utility modules change (standard pattern:
  // React uses __REACT_DEVTOOLS_GLOBAL_HOOK__, Vue uses __VUE_HMR_RUNTIME__).
  try {
    (globalThis as any).__ns_router = router;
  } catch {}
  return router;
}
