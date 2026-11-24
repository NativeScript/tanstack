// @vitest-environment jsdom
//
// Drives @tanstack/solid-router's own components (RouterContextProvider, Outlet →
// Match, Dynamic, memo) through the shipped `solid-web-shim.js`, with the
// NativeScript renderer swapped for a FakeNode-backed universal renderer. This is
// the wiring an app gets once nativescript.vite.mjs aliases `@solidjs/web`.

import { describe, it, expect, vi } from 'vitest';
import { Errored, createComponent, flush, untrack } from 'solid-js';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, getRouteApi, Match, Outlet, RouterContextProvider } from '@tanstack/solid-router';
import { FakeNode, collectTags } from './support/fake-native-renderer';

vi.mock('@nativescript-community/solid-js', async () => {
  const { createFakeCommunitySolid } = await import('./support/fake-native-renderer');
  return createFakeCommunitySolid();
});

vi.mock('@solidjs/web', async () => {
  return await import('../solid-web-shim.js');
});

const community = await import('@nativescript-community/solid-js');
const shim: any = await import('../solid-web-shim.js');

function renderIntoPage(router: any, view: () => any) {
  const page = new FakeNode('page');
  let caught: unknown;
  const dispose = community.render(
    () =>
      createComponent(RouterContextProvider as any, {
        router,
        children: () =>
          createComponent(Errored, {
            fallback: (err: () => unknown) => {
              caught = untrack(err);
              return null;
            },
            get children() {
              return view();
            },
          }),
      }),
    page,
  );
  return { page, dispose, caught: () => caught };
}

const settle = () => new Promise((r) => setTimeout(r, 30));

describe('NativeScript rendering pipeline (universal renderer + solid-web-shim)', () => {
  it('renders the leaf route component with reactive loaderData via getRouteApi', async () => {
    const rootRoute = createRootRoute();

    let homeInvocations = 0;
    let lastLoaderData: unknown = 'NOT_READ';

    const HomeComponent: any = () => {
      homeInvocations++;
      const loaderData = getRouteApi('/').useLoaderData();
      lastLoaderData = untrack(loaderData);
      const label = community.createElement('label');
      community.insert(label, () => `loaded:${(loaderData() as any)?.greeting ?? 'NONE'}`);
      return label;
    };

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: () => ({ greeting: 'hello' }),
      component: HomeComponent,
    });

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    await router.load();
    expect(router.state.matches.find((m) => m.routeId === '/')?.status).toBe('success');

    const { page, dispose, caught } = renderIntoPage(router, () => createComponent(HomeComponent, {}));
    await settle();

    expect(homeInvocations, 'Home should have rendered exactly once').toBe(1);
    expect(lastLoaderData).toEqual({ greeting: 'hello' });
    expect(caught()).toBeUndefined();
    expect(page.content?.tag).toBe('label');
    expect(page.content?.children[0]?.text).toBe('loaded:hello');

    dispose();
  });

  it("renders nested matches through the router's own <Match> / <Outlet /> (Dynamic, memo, mergeProps from the shim)", async () => {
    const rootRoute = createRootRoute();

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/virtual',
      component: () => {
        const stack = community.createElement('stacklayout');
        community.insert(stack, () => createComponent(Outlet, {}));
        return stack;
      },
    });

    const inspectorRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: '/inspector',
      loader: () => ({ title: 'Inspector' }),
      component: () => {
        const data = getRouteApi('/virtual/inspector').useLoaderData();
        const label = community.createElement('label');
        community.insert(label, () => (data() as any).title);
        return label;
      },
    });

    const router = createRouter({
      routeTree: rootRoute.addChildren([layoutRoute.addChildren([inspectorRoute])]),
      history: createMemoryHistory({ initialEntries: ['/virtual/inspector'] }),
    });

    await router.load();

    const { page, dispose, caught } = renderIntoPage(router, () => createComponent(Match, { routeId: layoutRoute.id }));
    await settle();

    expect(caught()).toBeUndefined();
    expect(collectTags(page)).toEqual(['stacklayout', 'label']);
    const label = page.content!.children.find((c) => c.tag === 'label');
    expect(label?.children[0]?.text).toBe('Inspector');

    dispose();
  });
});

describe('solid-web-shim', () => {
  it('Dynamic creates intrinsic elements through the NativeScript renderer', () => {
    const host = new FakeNode('page');
    const dispose = community.render(() => createComponent(shim.Dynamic, { component: 'label', text: 'hi' }), host);
    flush();

    expect(host.content?.tag).toBe('label');
    expect(host.content?.attrs.text).toBe('hi');
    dispose();
  });

  it('Dynamic renders function components and nothing for an unset component', () => {
    const host = new FakeNode('page');
    const Comp = (props: { text: string }) => {
      const node = community.createElement('button');
      community.setProp(node, 'text', props.text);
      return node;
    };
    const dispose = community.render(() => [createComponent(shim.Dynamic, { component: Comp, text: 'tap' }), createComponent(shim.Dynamic, { component: undefined })], host);
    flush();

    expect(collectTags(host)).toEqual(['button']);
    expect(host.content?.attrs.text).toBe('tap');
    dispose();
  });

  it('DOM templates fail loudly when instantiated instead of yielding an undefined node', () => {
    const create = shim.template('<p>Not Found');
    expect(() => create()).toThrow(/<p> DOM fallback cannot render in NativeScript/);
  });

  it('reports a client environment', () => {
    expect(shim.isServer).toBe(false);
  });
});
