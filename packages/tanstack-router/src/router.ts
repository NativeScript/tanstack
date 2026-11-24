import { createRouter, type AnyRoute } from '@tanstack/solid-router';
import { AbortController as NativeScriptAbortController, AbortSignal as NativeScriptAbortSignal } from '@nativescript/core/abortcontroller';
import { createNativeScriptHistory } from './history';

// NativeScript polyfills — TanStack Router requires these globals.
// Runs at module load time, after imports resolve but before any router is created.
if (typeof self === 'undefined') {
  (globalThis as any).self = globalThis;
}
// router-core resets window scroll after every render; NativeScript pages own
// their scroll state, so the global is a no-op.
if (typeof (globalThis as any).scrollTo !== 'function') {
  (globalThis as any).scrollTo = () => {};
}
if (typeof AbortController === 'undefined') {
  (globalThis as any).AbortController = NativeScriptAbortController;
  (globalThis as any).AbortSignal = NativeScriptAbortSignal;
}

type RouterOptions<TRouteTree extends AnyRoute> = Parameters<typeof createRouter<TRouteTree>>[0];

type NativeScriptRouterOptions<TRouteTree extends AnyRoute> = Omit<RouterOptions<TRouteTree>, 'history'> & {
  initialPath?: string;
};

/** Creates a router without registering it as the app router (used for modal stacks). */
export function createDetachedNativeScriptRouter<TRouteTree extends AnyRoute>(opts: NativeScriptRouterOptions<TRouteTree>) {
  const { initialPath, ...routerOpts } = opts;
  return createRouter<TRouteTree>({
    ...(routerOpts as RouterOptions<TRouteTree>),
    history: createNativeScriptHistory({ initialPath }),
  });
}

export function createNativeScriptRouter<TRouteTree extends AnyRoute>(opts: NativeScriptRouterOptions<TRouteTree>) {
  const router = createDetachedNativeScriptRouter(opts);
  // Dev-only: expose router for HMR client to patch route loaders
  // when non-component utility modules change (standard pattern:
  // React uses __REACT_DEVTOOLS_GLOBAL_HOOK__, Vue uses __VUE_HMR_RUNTIME__).
  try {
    (globalThis as any).__ns_router = router;
  } catch {}
  return router;
}
