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
  return createRouter<TRouteTree>({
    ...(routerOpts as RouterOptions<TRouteTree>),
    history: createNativeScriptHistory({ initialPath }),
  });
}
