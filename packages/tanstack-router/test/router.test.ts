// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRootRoute, createRoute } from '@tanstack/solid-router';
import { createDetachedNativeScriptRouter, createNativeScriptRouter } from '../src/router';

vi.mock('@nativescript/core/abortcontroller', () => ({
  AbortController: globalThis.AbortController,
  AbortSignal: globalThis.AbortSignal,
}));

function routeTree() {
  const rootRoute = createRootRoute();
  return rootRoute.addChildren([createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => null })]);
}

describe('createNativeScriptRouter', () => {
  afterEach(() => {
    delete (globalThis as any).__ns_router;
  });

  it('registers the app router for HMR', () => {
    const router = createNativeScriptRouter({ routeTree: routeTree() });
    expect((globalThis as any).__ns_router).toBe(router);
  });

  it('keeps the app router registered when a detached (modal) router is created', () => {
    const app = createNativeScriptRouter({ routeTree: routeTree() });
    const modal = createDetachedNativeScriptRouter({ routeTree: routeTree(), initialPath: '/' });
    expect(modal).not.toBe(app);
    expect((globalThis as any).__ns_router).toBe(app);
  });
});
