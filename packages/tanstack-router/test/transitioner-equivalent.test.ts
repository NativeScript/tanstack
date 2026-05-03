// @vitest-environment jsdom
//
// Verifies that the @tanstack/solid-router 1.168+ signal-based router state
// (`router.stores.{isLoading,hasPending,status,resolvedLocation}`) settles
// correctly under the same accumulator-style createEffect we use in
// `NativeScriptRouterProvider` (modeled after solid-router's internal
// `<Transitioner />`). This is a stand-in for the real provider — we can't
// mount the full NS Frame in a node test — but it covers the failure mode we
// hit shipping 0.1.0: the manual `.set('idle')` hack against the new signal
// store left the router stuck at `status === 'pending'` after `router.load()`.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { batch, createEffect, createMemo, createRoot } from 'solid-js';
import { createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/solid-router';

vi.mock('solid-js/web', async () => {
  return await import('../solid-web-shim.js');
});

beforeAll(() => {
  process.env.NODE_ENV = 'development';
});

describe('Transitioner-equivalent reactive effect', () => {
  it('flips status from pending → idle when isLoading + hasPending settle after router.load()', async () => {
    const rootRoute = createRootRoute();
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: async () => {
        // Force a microtask boundary so isLoading is observably true at some point
        await new Promise((r) => setTimeout(r, 5));
        return { ok: true };
      },
      component: () => null as any,
    });

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    // Same as `NativeScriptRouterProvider`: synchronous startTransition because
    // we don't render <Transitioner /> in NS.
    router.startTransition = (fn: () => void) => fn();

    let observedSettlements = 0;
    const cleanup = createRoot((dispose) => {
      const isAnyPending = createMemo(() => {
        const stores = (router as any).stores;
        if (!stores) return false;
        return Boolean(stores.isLoading?.get?.() ?? false) || Boolean(stores.hasPending?.get?.() ?? false);
      });

      createEffect((prev: boolean = false) => {
        const cur = isAnyPending();
        if (prev && !cur) {
          observedSettlements++;
          const stores = (router as any).stores;
          batch(() => {
            stores.status?.set?.('idle');
            if (stores.resolvedLocation && stores.location) {
              stores.resolvedLocation.set(stores.location.get());
            }
          });
        }
        return cur;
      });

      return dispose;
    });

    // Sanity: before load, status starts at 'idle' (router default initial
    // state) and there's nothing pending.
    expect(router.state.status).toBe('idle');

    await router.load();
    // Allow the createEffect to flush after the load resolves
    await new Promise((r) => setTimeout(r, 30));

    expect(observedSettlements, 'effect should observe exactly one pending→idle transition for the initial load').toBe(1);
    expect(router.state.status).toBe('idle');
    expect(router.state.matches.length).toBeGreaterThan(0);
    expect(router.state.matches.find((m) => m.routeId === '/')?.status).toBe('success');
    expect(router.state.resolvedLocation?.pathname).toBe('/');

    cleanup();
  });
});
