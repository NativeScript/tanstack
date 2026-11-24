// @vitest-environment jsdom
//
// Runs the shipped `renderPage` against a real router, with only the NativeScript
// layer faked: `@nativescript-community/solid-js` is a FakeNode-backed universal
// renderer and `document.createElement('Page')` returns a FakeNode page that
// fills NativeScript's `actionBar` / `content` slots.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, getRouteApi } from '@tanstack/solid-router';
import { FakeNode, collectTags } from './support/fake-native-renderer';

vi.mock('@nativescript-community/solid-js', async () => {
  const { createFakeCommunitySolid } = await import('./support/fake-native-renderer');
  return createFakeCommunitySolid();
});

vi.mock('@solidjs/web', async () => {
  return await import('../solid-web-shim.js');
});

vi.mock('@nativescript/core', () => ({}));

const community = await import('@nativescript-community/solid-js');
const { renderPage } = await import('../src/PageRenderer');

const originalCreateElement = document.createElement;

beforeAll(() => {
  (document as any).createElement = (tag: string) => new FakeNode(tag.toLowerCase());
});

afterAll(() => {
  (document as any).createElement = originalCreateElement;
});

const settle = () => new Promise((r) => setTimeout(r, 30));

function createLabel(text: string) {
  const label = community.createElement('label');
  community.setProp(label, 'text', text);
  return label;
}

async function createLoadedRouter(component: () => any) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    loader: () => ({ greeting: 'hi' }),
    component,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  expect(router.state.matches.find((m) => m.routeId === '/')?.status).toBe('success');
  return router;
}

describe('renderPage (deployed render flow)', () => {
  it('slots a fragment-returning route component into the Page actionBar and content', async () => {
    const router = await createLoadedRouter(() => {
      const data = getRouteApi('/').useLoaderData();
      const actionBar = community.createElement('actionbar');
      community.setProp(actionBar, 'title', 'TanStack Router');
      const scroll = community.createElement('scrollview');
      const stack = community.createElement('stacklayout');
      community.insert(stack, () => createLabel(`greeting:${(data() as any).greeting}`));
      community.insertNode(scroll, stack);
      return [actionBar, scroll];
    });

    const Home = (router as any).routesById['/'].options.component;
    const page = renderPage(router as any, Home, '/') as FakeNode;
    await settle();

    expect(page.actionBar?.tag).toBe('actionbar');
    expect(page.actionBar?.attrs.title).toBe('TanStack Router');
    expect(page.content?.tag).toBe('scrollview');
    expect(collectTags(page)).toEqual(['actionbar', 'scrollview', 'stacklayout', 'label']);
    const label = page.content!.children[0].children[0];
    expect(label.attrs.text).toBe('greeting:hi');
  });

  it('renders per-page chrome beside the route content', async () => {
    const router = await createLoadedRouter(() => community.createElement('stacklayout'));
    const Home = (router as any).routesById['/'].options.component;

    const page = renderPage(router as any, Home, '/', undefined, undefined, false, () => {
      const actionBar = community.createElement('actionbar');
      community.setProp(actionBar, 'title', 'Chrome');
      return actionBar;
    }) as FakeNode;
    await settle();

    expect(page.actionBar?.attrs.title).toBe('Chrome');
    expect(page.content?.tag).toBe('stacklayout');
  });

  it('swallows reactive route errors and resets the boundary when the page loads again', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    const router = await createLoadedRouter(() => {
      const stack = community.createElement('stacklayout');
      community.insert(stack, () => {
        if (shouldThrow) throw new Error('boom');
        return createLabel('recovered');
      });
      return stack;
    });
    const Home = (router as any).routesById['/'].options.component;

    const page = renderPage(router as any, Home, '/') as FakeNode;
    await settle();

    expect(collectTags(page)).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith('[NSRouter] Errored caught:', expect.objectContaining({ message: 'boom' }));

    shouldThrow = false;
    page.emit('loaded');
    await settle();

    expect(collectTags(page)).toEqual(['stacklayout', 'label']);
    errorSpy.mockRestore();
  });

  it('keeps the views of a page popped by native back, and remounts cleanly afterwards', async () => {
    const router = await createLoadedRouter(() => createLabel('first'));
    const Home = (router as any).routesById['/'].options.component;
    const page = renderPage(router as any, Home, '/') as FakeNode;
    await settle();

    page.emit('navigatingFrom', { isBackNavigation: true });
    expect(page.content?.attrs.text, 'views stay attached for the pop animation').toBe('first');

    page.emit('navigatedTo');
    await settle();
    expect(page.children.filter((c) => c.tag !== '#text')).toHaveLength(1);
    expect(page.content?.attrs.text).toBe('first');
  });

  it('__ns_remount swaps the route component in place', async () => {
    const router = await createLoadedRouter(() => createLabel('before'));
    const Home = (router as any).routesById['/'].options.component;
    const page = renderPage(router as any, Home, '/') as any;
    await settle();
    expect(page.content?.attrs.text).toBe('before');

    page.__ns_remount(() => createLabel('after'));
    await settle();

    expect(page.children.filter((c: FakeNode) => c.tag !== '#text')).toHaveLength(1);
    expect(page.content?.attrs.text).toBe('after');
  });
});
