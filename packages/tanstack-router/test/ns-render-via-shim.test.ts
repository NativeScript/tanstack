// @vitest-environment jsdom
//
// Reproduces the NativeScript rendering pipeline using the universal Solid
// renderer plus our `solid-web-shim.js`, mirroring how the @nativescript/vite
// `solid` config aliases `solid-js/web` for app builds. This catches the kind
// of cross-package reactivity bugs that show up as "blank screen" in NS at
// runtime — for instance, the 1.168+ regression where `useMatch` couldn't
// resolve the active match and `<RouterContextProvider>` ended up rendering
// nothing because our shim's `memo()` wasn't actually memoizing.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createRenderer } from 'solid-js/universal';
import { createComponent, ErrorBoundary } from 'solid-js';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, getRouteApi, RouterContextProvider } from '@tanstack/solid-router';

// Provide a `solid-js/web` alias backed by the actual shim file shipped in
// the package so the imports from @tanstack/solid-router resolve through it.
vi.mock('solid-js/web', async () => {
  return await import('../solid-web-shim.js');
});

beforeAll(() => {
  process.env.NODE_ENV = 'development';
});

// Minimal "NativeScript-like" element backing — just a tiny tagged tree we
// can introspect to verify children were inserted.
type FakeNode = {
  tag: string;
  text?: string;
  children: Array<FakeNode>;
  parent?: FakeNode;
  attrs: Record<string, unknown>;
};

function makeNode(tag: string): FakeNode {
  return { tag, children: [], attrs: {} };
}

const universal = createRenderer<FakeNode>({
  createElement(tag) {
    return makeNode(tag);
  },
  createTextNode(value) {
    const n = makeNode('#text');
    n.text = value;
    return n;
  },
  isTextNode(node) {
    return node.tag === '#text';
  },
  replaceText(node, value) {
    node.text = value;
  },
  setProperty(node, name, value) {
    node.attrs[name] = value;
  },
  insertNode(parent, node, anchor) {
    if (anchor) {
      const idx = parent.children.indexOf(anchor);
      parent.children.splice(idx, 0, node);
    } else {
      parent.children.push(node);
    }
    node.parent = parent;
  },
  removeNode(parent, node) {
    const idx = parent.children.indexOf(node);
    if (idx >= 0) parent.children.splice(idx, 1);
    node.parent = undefined;
  },
  getParentNode(node) {
    return node.parent as FakeNode;
  },
  getFirstChild(node) {
    return node.children[0] as FakeNode;
  },
  getNextSibling(node) {
    if (!node.parent) return undefined as unknown as FakeNode;
    const idx = node.parent.children.indexOf(node);
    return node.parent.children[idx + 1] as FakeNode;
  },
});

describe('NativeScript rendering pipeline (universal renderer + solid-web-shim)', () => {
  it('renders the leaf route component with reactive loaderData via getRouteApi', async () => {
    const rootRoute = createRootRoute();

    let homeInvocations = 0;
    let lastLoaderData: unknown = 'NOT_READ';

    const HomeComponent: any = () => {
      homeInvocations++;
      const route = getRouteApi('/');
      const loaderData = route.useLoaderData();
      lastLoaderData = loaderData();
      // Build a small NS-style tree so we can verify it was inserted into the page
      const label = makeNode('label');
      label.attrs.text = `loaded:${(loaderData() as any)?.greeting ?? 'NONE'}`;
      const stack = makeNode('stacklayout');
      stack.children = [label];
      label.parent = stack;
      return stack;
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

    const page = makeNode('page');
    let caught: any;
    const dispose = universal.render(
      (() =>
        createComponent(RouterContextProvider as any, {
          router,
          children: () =>
            createComponent(ErrorBoundary, {
              fallback: (err: any) => {
                caught = err;
                return null as any;
              },
              get children() {
                return createComponent(HomeComponent, {});
              },
            }),
        })) as any,
      page,
    );

    // Allow Solid effects to flush
    await new Promise((r) => setTimeout(r, 50));

    expect(homeInvocations, 'Home should have rendered exactly once').toBe(1);
    expect(lastLoaderData).toEqual({ greeting: 'hello' });
    expect(caught, `ErrorBoundary should not have caught anything but got: ${caught?.message ?? caught}`).toBeUndefined();
    expect(page.children.length, 'page should have an inserted view subtree').toBeGreaterThan(0);

    dispose();
  });
});
