// @vitest-environment jsdom

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createRenderer } from 'solid-js/universal';
import { ErrorBoundary, createComponent } from 'solid-js';
import { RouterContextProvider, createMemoryHistory, createRootRoute, createRoute, createRouter, getRouteApi } from '@tanstack/solid-router';

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
};

function makeNode(tag: string): FakeNode {
  return { tag, attrs: {}, children: [] };
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

// Mimic exactly what tsup's auto-jsx-runtime emits for our PageRenderer.tsx
function shimJsx(type: any, props?: any): any {
  if (typeof type === 'function') {
    return createComponent(type, props || {});
  }
  return { type, props: props || {} };
}

describe('Page subtree where the route component returns a fragment (array)', () => {
  it('inserts both fragment children into the page', async () => {
    const rootRoute = createRootRoute();

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: () => ({ greeting: 'hi' }),
      // Mimic babel-preset-solid output for `<><actionbar/><scrollview/></>`:
      // returns an array of two universal nodes.
      component: () => {
        const route = getRouteApi('/');
        const data = route.useLoaderData();
        // touch loaderData so useMatch wires up
        void data();
        const ab = universal.createElement('actionbar');
        universal.setProp(ab, 'title', 'TanStack Router', undefined);
        const sv = universal.createElement('scrollview');
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

    // Mirror PageRenderer.tsx's exact JSX shape (eager children via shimJsx)
    const dispose = universal.render(
      (() =>
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
        })) as any,
      page,
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(caught, `ErrorBoundary should not have caught anything but got: ${caught?.message ?? caught}`).toBeUndefined();
    expect(page.children.length, 'page must have inserted children').toBeGreaterThan(0);
    // The page should contain both of Home's fragment children
    const tags = collectTagsRecursively(page);
    expect(tags).toContain('actionbar');
    expect(tags).toContain('scrollview');

    dispose();
  });
});

function collectTagsRecursively(node: FakeNode, out: Array<string> = []): Array<string> {
  for (const child of node.children) {
    out.push(child.tag);
    collectTagsRecursively(child, out);
  }
  return out;
}
