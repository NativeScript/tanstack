// @vitest-environment jsdom
//
// Mounts NativeScriptRouterProvider against a fake Frame to check the Solid
// lifecycle end to end: initial load after settle, router-driven Frame pushes
// and pops, and teardown.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createComponent } from 'solid-js';
import { createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/solid-router';
import { FakeNode } from './support/fake-native-renderer';

vi.mock('@nativescript-community/solid-js', async () => {
  const { createFakeCommunitySolid } = await import('./support/fake-native-renderer');
  return createFakeCommunitySolid();
});

vi.mock('@solidjs/web', async () => {
  return await import('../solid-web-shim.js');
});

vi.mock('@nativescript/core', () => ({
  Application: { android: undefined },
  isAndroid: false,
  Color: class {},
  Utils: {},
}));

vi.mock('@nativescript/core/abortcontroller', () => ({
  AbortController: globalThis.AbortController,
  AbortSignal: globalThis.AbortSignal,
}));

const community = await import('@nativescript-community/solid-js');
const { NativeScriptRouterProvider } = await import('../src/NativeScriptRouterProvider');

class FakeFrame extends FakeNode {
  currentPage?: FakeNode;
  backStack: FakeNode[] = [];
  navigations: Array<{ animated?: boolean; backstackVisible?: boolean }> = [];

  navigate(entry: { create: () => FakeNode; animated?: boolean; backstackVisible?: boolean }) {
    this.navigations.push({ animated: entry.animated, backstackVisible: entry.backstackVisible });
    const page = entry.create();
    if (this.currentPage && entry.backstackVisible !== false) this.backStack.push(this.currentPage);
    this.currentPage = page;
    page.emit('navigatedTo', { isBackNavigation: false });
  }

  canGoBack() {
    return this.backStack.length > 0;
  }

  goBack() {
    const page = this.backStack.pop();
    if (!page) return;
    this.currentPage?.emit('navigatingFrom', { isBackNavigation: true });
    this.currentPage = page;
    page.emit('navigatedTo', { isBackNavigation: true });
  }
}

const originalCreateElement = document.createElement;

beforeAll(() => {
  (document as any).createElement = (tag: string) => (tag.toLowerCase() === 'frame' ? new FakeFrame('frame') : new FakeNode(tag.toLowerCase()));
});

afterAll(() => {
  (document as any).createElement = originalCreateElement;
});

const settle = () => new Promise((r) => setTimeout(r, 30));

function label(text: string) {
  return () => {
    const node = community.createElement('label');
    community.setProp(node, 'text', text);
    return node;
  };
}

function createTestRouter() {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([createRoute({ getParentRoute: () => rootRoute, path: '/', component: label('home') }), createRoute({ getParentRoute: () => rootRoute, path: '/about', component: label('about') })]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
}

describe('NativeScriptRouterProvider', () => {
  it('loads the initial route and pushes / pops Frame pages as the router navigates', async () => {
    const router = createTestRouter();
    const host = new FakeNode('page');
    const dispose = community.render(() => createComponent(NativeScriptRouterProvider, { router }), host);

    const frame = host.content as unknown as FakeFrame;
    expect(frame).toBeInstanceOf(FakeFrame);
    expect(frame.attrs.actionBarVisibility).toBe('never');

    await settle();
    expect(router.state.status).toBe('idle');
    expect(frame.navigations).toHaveLength(1);
    expect(frame.navigations[0].animated).toBe(false);
    expect(frame.currentPage?.content?.attrs.text).toBe('home');

    await router.navigate({ to: '/about' });
    await settle();
    expect(frame.navigations).toHaveLength(2);
    expect(frame.navigations[1]).toEqual({ animated: true, backstackVisible: true });
    expect(frame.currentPage?.content?.attrs.text).toBe('about');
    expect(frame.backStack).toHaveLength(1);

    router.history.back();
    await settle();
    expect(router.state.location.pathname).toBe('/');
    expect(frame.backStack).toHaveLength(0);
    expect(frame.currentPage?.content?.attrs.text).toBe('home');

    dispose();
  });

  it('stops reacting to router navigation once disposed', async () => {
    const router = createTestRouter();
    const host = new FakeNode('page');
    const dispose = community.render(() => createComponent(NativeScriptRouterProvider, { router }), host);
    const frame = host.content as unknown as FakeFrame;
    await settle();
    expect(frame.navigations).toHaveLength(1);

    dispose();
    router.history.push('/about');
    await settle();

    expect(frame.navigations).toHaveLength(1);
  });
});
