// @vitest-environment jsdom
//
// Closest possible reproduction of the deployed bundle's render flow:
//   - universal renderer (just like @nativescript-community/solid-js)
//   - the published `solid-js-jsx-runtime-shim.js`'s `jsx` function (via dynamic import)
//   - the published `renderPage` shape: render(() => jsx(RouterContextProvider, {router, children: () => jsx(ErrorBoundary, {fallback, children: jsx(SafeRouteView, {})})}), page)
//   - SafeRouteView -> Home -> returns ARRAY [actionbar, scrollview-tree]

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createRenderer } from 'solid-js/universal';
import { ErrorBoundary, createComponent } from 'solid-js';
import { RouterContextProvider, createMemoryHistory, createRootRoute, createRoute, createRouter, getRouteApi } from '@tanstack/solid-router';
// Load the actual published shim's jsx (same file that ships in the package)
import { jsx } from '../solid-js-jsx-runtime-shim.js';

vi.mock('solid-js/web', async () => {
  return await import('../solid-web-shim.js');
});

beforeAll(() => {
  process.env.NODE_ENV = 'development';
});

type FakeNode = {
  tag: string;
  text?: string;
  attrs: Record<string, unknown>;
  children: Array<FakeNode>;
  parent?: FakeNode;
  // dominative-Page-style content + actionBar slots
  actionBar?: FakeNode;
  content?: FakeNode;
  isPage?: boolean;
  isActionBar?: boolean;
};

function makeNode(tag: string): FakeNode {
  const node: FakeNode = { tag, attrs: {}, children: [] };
  if (tag === 'page' || tag === 'Page') node.isPage = true;
  if (tag === 'actionbar') node.isActionBar = true;
  return node;
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
    // Mimic dominative Page child handling
    if (parent.isPage) {
      if (node.isActionBar) parent.actionBar = node;
      else parent.content = node;
    }
  },
  removeNode(parent, node) {
    const idx = parent.children.indexOf(node);
    if (idx >= 0) parent.children.splice(idx, 1);
    if (parent.actionBar === node) parent.actionBar = undefined;
    if (parent.content === node) parent.content = undefined;
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

describe('Full deployed render flow', () => {
  it('inserts actionbar + scrollview into Page when Home returns a fragment array', async () => {
    const rootRoute = createRootRoute();

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: () => ({ greeting: 'hi' }),
      component: () => {
        // Mimic what babel-preset-solid emits for Home()
        const route = getRouteApi('/');
        const data = route.useLoaderData();
        void data();
        const ab = universal.createElement('actionbar');
        universal.setProp(ab, 'title', 'TanStack Router', undefined);
        const sv = universal.createElement('scrollview');
        const sl = universal.createElement('stacklayout');
        const lbl = universal.createElement('label');
        universal.setProp(lbl, 'text', 'Native SolidJS News', undefined);
        universal.insertNode(sl, lbl);
        universal.insertNode(sv, sl);
        return [ab, sv] as any;
      },
    });

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    await router.load();
    expect(router.state.matches.find((m) => m.routeId === '/')?.status).toBe('success');

    const page = makeNode('page');
    let caught: any;

    const Comp = (indexRoute as any).options.component;
    const SafeRouteView = () => createComponent(Comp, {});

    const dispose = universal.render(
      (() =>
        jsx(RouterContextProvider, {
          router,
          children: () =>
            jsx(ErrorBoundary, {
              fallback: (err: any) => {
                caught = err;
                return null;
              },
              children: jsx(SafeRouteView, {}),
            }),
        })) as any,
      page,
    );

    await new Promise((r) => setTimeout(r, 50));

    // Diagnose
    if (page.children.length === 0) {
      console.error('Page is EMPTY — repro!');
      console.error(
        'Page snapshot:',
        JSON.stringify(page, (k, v) => (k === 'parent' ? undefined : v), 2),
      );
    }

    expect(caught, `ErrorBoundary should not have caught anything but got: ${caught?.message ?? caught}`).toBeUndefined();
    expect(page.children.length, 'page should have inserted children').toBeGreaterThan(0);
    expect(page.actionBar?.tag).toBe('actionbar');
    expect(page.actionBar?.attrs.title).toBe('TanStack Router');
    expect(page.content?.tag).toBe('scrollview');

    dispose();
  });
});
