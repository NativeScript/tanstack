// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, getRouteApi, RouterContextProvider } from '@tanstack/solid-router';
import { createComponent, createRoot, ErrorBoundary } from 'solid-js';
import { render } from 'solid-js/web';

// Reproduces white-screen scenario:
//   1. createRouter + load() (matches reach `success`, status stays `pending`)
//   2. Render a page subtree containing a route component that calls `useLoaderData`
//   3. useMatch's `createEffect` should find the match and NOT throw "Could not find an active match"

describe('TanStack Router render path', () => {
  beforeAll(() => {
    // Ensure NODE_ENV is not 'production' so the throw branch in useMatch is active (matches dev runtime)
    process.env.NODE_ENV = 'development';
  });

  it('useLoaderData inside a render() subtree finds its match after router.load()', async () => {
    const rootRoute = createRootRoute();

    let homeRendered = false;
    let homeLoaderDataAtRender: unknown = 'NOT_READ';

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: () => ({ greeting: 'hello' }),
      component: () => {
        homeRendered = true;
        const route = getRouteApi('/');
        const data = route.useLoaderData();
        homeLoaderDataAtRender = data();
        // Return a real DOM node so render() doesn't bail
        return document.createElement('div');
      },
    });

    const routeTree = rootRoute.addChildren([indexRoute]);

    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    await router.load();

    // Sanity: matches loaded
    expect(router.state.matches.length).toBeGreaterThan(0);
    const indexMatch = router.state.matches.find((m) => m.routeId === '/');
    expect(indexMatch, 'index match present after load').toBeTruthy();
    expect(indexMatch!.status).toBe('success');

    // Render exactly the way the NS PageRenderer does
    const host = document.createElement('div');
    let caughtError: any;
    const dispose = createRoot((dispose) => {
      const root = render(
        () =>
          createComponent(RouterContextProvider as any, {
            router,
            children: () =>
              createComponent(ErrorBoundary, {
                fallback: (err: any) => {
                  caughtError = err;
                  return null as any;
                },
                get children() {
                  const Comp = (indexRoute as any).options.component;
                  return createComponent(Comp, {});
                },
              }),
          }),
        host,
      );
      return () => {
        root();
        dispose();
      };
    });

    // Allow Solid effects to flush
    await new Promise((r) => setTimeout(r, 50));

    expect(homeRendered, 'Home component should have been invoked').toBe(true);
    expect(homeLoaderDataAtRender).toEqual({ greeting: 'hello' });
    expect(caughtError, `ErrorBoundary should not have caught anything but got: ${caughtError?.message ?? caughtError}`).toBeUndefined();

    dispose();
  });
});
