// @vitest-environment jsdom
//
// In the eager case, `jsx(Inner, {})` is evaluated when the props object
// literal is constructed — BEFORE the Provider sets its context. Components
// rendered inside `Inner` therefore can't find the context, so `useRouter()`
// returns null, `useMatch` throws, and the page goes blank.
//

import { describe, it, expect, beforeAll } from 'vitest';
import { createComponent, ErrorBoundary } from 'solid-js';
import { render } from 'solid-js/web';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, getRouteApi, RouterContextProvider, useRouter } from '@tanstack/solid-router';

// Mimic the shim's jsx exactly (the one shipped in solid-js-jsx-runtime-shim.js
// and @nativescript/vite/shims/solid-jsx-runtime.js). The published
// `solid/index.mjs` ultimately resolves `import { jsx } from 'solid-js/jsx-runtime'`
// to one of these shims at consumer-build time.
function shimJsx(type: any, props?: any): any {
  if (typeof type === 'function') {
    return createComponent(type, props || {});
  }
  return { type, props: props || {} };
}

beforeAll(() => {
  process.env.NODE_ENV = 'development';
});

describe('PageRenderer JSX → router context propagation', () => {
  it('finds the active match when shimJsx eagerly evaluates nested children', async () => {
    const rootRoute = createRootRoute();

    let homeRendered = false;
    let lastLoaderData: unknown = 'NOT_READ';
    let routerInsideHome: unknown;

    const Home = () => {
      homeRendered = true;
      // Snapshot the resolved router so we can assert context wiring
      routerInsideHome = useRouter();
      const route = getRouteApi('/');
      const data = route.useLoaderData();
      lastLoaderData = data();
      return document.createElement('div');
    };

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: () => ({ greeting: 'hi' }),
      component: Home,
    });

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    await router.load();
    expect(router.state.matches.find((m) => m.routeId === '/')?.status).toBe('success');

    const host = document.createElement('div');
    let caught: any;

    // Mirror exactly what the bundled `renderPage` produces:
    //   jsx(RouterContextProvider, {
    //     router,
    //     children: () => jsx(ErrorBoundary, {
    //       fallback: ...,
    //       children: jsx(SafeRouteView, {})   // ← eager, NO getter
    //     })
    //   })
    const SafeRouteView = () => createComponent(Home, {});
    const dispose = render(
      () =>
        shimJsx(RouterContextProvider, {
          router,
          children: () =>
            shimJsx(ErrorBoundary, {
              fallback: (err: any) => {
                caught = err;
                return null;
              },
              children: shimJsx(SafeRouteView, {}),
            }),
        }),
      host,
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(caught, `ErrorBoundary should not have caught anything but got: ${caught?.message ?? caught}`).toBeUndefined();
    expect(homeRendered, 'Home should have been invoked').toBe(true);
    expect(routerInsideHome, 'useRouter() inside Home should resolve to the provided router').toBe(router);
    expect(lastLoaderData).toEqual({ greeting: 'hi' });

    dispose();
  });
});
