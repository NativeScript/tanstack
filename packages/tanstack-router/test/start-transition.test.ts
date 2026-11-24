// @vitest-environment jsdom
//
// NativeScript never mounts solid-router's <Transitioner />, so the provider
// installs its own transition hook. With it, a load must still settle the router
// the way <Transitioner /> does on the web: matches committed, status back to
// idle, resolvedLocation set, onResolved / onRendered emitted.

import { describe, it, expect } from 'vitest';
import { createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/solid-router';
import { installNativeScriptStartTransition } from '../src/start-transition';

function createTestRouter() {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    loader: async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { ok: true };
    },
    component: () => null,
  });
  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/about',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, aboutRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  installNativeScriptStartTransition(router);
  return router;
}

describe('installNativeScriptStartTransition', () => {
  it('settles the initial load: idle status, resolved location, onResolved + onRendered', async () => {
    const router = createTestRouter();
    const events: string[] = [];
    router.subscribe('onResolved', () => events.push('onResolved'));
    router.subscribe('onRendered', () => events.push('onRendered'));

    expect(router.state.status).toBe('idle');

    await router.load();

    expect(router.state.status).toBe('idle');
    expect(router.state.matches.find((m) => m.routeId === '/')?.status).toBe('success');
    expect(router.state.resolvedLocation?.pathname).toBe('/');
    expect(events).toEqual(['onResolved', 'onRendered']);
  });

  it('commits a follow-up navigation', async () => {
    const router = createTestRouter();
    await router.load();

    await router.navigate({ to: '/about' });
    await router.load();

    expect(router.state.location.pathname).toBe('/about');
    expect(router.state.matches.at(-1)?.routeId).toBe('/about');
    expect(router.state.status).toBe('idle');
    expect(router.state.resolvedLocation?.pathname).toBe('/about');
  });
});
