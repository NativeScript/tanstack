// @vitest-environment jsdom
//
// Modal routes (`?@modal=`) and Android hardware back, driven through
// NativeScriptRouterProvider against a fake Frame/Page that models
// NativeScript's backstack rules and asynchronous dialog dismissal.

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createComponent } from 'solid-js';
import { createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/solid-router';
import { FakeNode } from './support/fake-native-renderer';
import { FakeFrame, FakePage, createFakeElementFactory, presentedModals } from './support/fake-frame';

const backListeners: Array<(args: any) => void> = [];

vi.mock('@nativescript-community/solid-js', async () => {
  const { createFakeCommunitySolid } = await import('./support/fake-native-renderer');
  return createFakeCommunitySolid();
});

vi.mock('@solidjs/web', async () => {
  return await import('../solid-web-shim.js');
});

vi.mock('@nativescript/core', () => ({
  Application: {
    android: {
      on: (_event: string, fn: (args: any) => void) => backListeners.push(fn),
      off: (_event: string, fn: (args: any) => void) => {
        const idx = backListeners.indexOf(fn);
        if (idx >= 0) backListeners.splice(idx, 1);
      },
    },
  },
  isAndroid: true,
  Color: class {},
  Utils: {},
}));

vi.mock('@nativescript/core/abortcontroller', () => ({
  AbortController: globalThis.AbortController,
  AbortSignal: globalThis.AbortSignal,
}));

(globalThis as any).__ANDROID__ = true;
(globalThis as any).__IOS__ = false;

const community = await import('@nativescript-community/solid-js');
const { NativeScriptRouterProvider } = await import('../src/NativeScriptRouterProvider');

const originalCreateElement = document.createElement;

beforeAll(() => {
  (document as any).createElement = createFakeElementFactory();
});

afterAll(() => {
  (document as any).createElement = originalCreateElement;
});

afterEach(() => {
  presentedModals.length = 0;
});

const settle = () => new Promise((r) => setTimeout(r, 40));

function label(text: string) {
  return () => {
    const node = community.createElement('label');
    community.setProp(node, 'text', text);
    return node;
  };
}

function setup() {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([createRoute({ getParentRoute: () => rootRoute, path: '/', component: label('home') }), createRoute({ getParentRoute: () => rootRoute, path: '/posts', component: label('posts') }), createRoute({ getParentRoute: () => rootRoute, path: '/about', component: label('about') }), createRoute({ getParentRoute: () => rootRoute, path: '/users/$userId', component: label('user') })]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const host = new FakeNode('page');
  const dispose = community.render(() => createComponent(NativeScriptRouterProvider, { router, debug: !!process.env.NSR_DEBUG }), host);
  const frame = host.content as unknown as FakeFrame;
  return { router, frame, dispose };
}

const historyIndex = (router: any) => router.history.location.state.__TSR_index;
const modalOf = (router: any) => router.state.location.search['@modal'];

function pressHardwareBack() {
  const args = { cancel: false };
  for (const fn of [...backListeners]) fn(args);
  return args;
}

async function openAuthorModal(router: any, userId: string) {
  await router.navigate({ to: '/posts', search: { '@modal': `/users/${userId}` } });
  await settle();
}

describe('NativeScriptRouterProvider modal routes', () => {
  it('reopens the same modal after it was closed from inside the modal', async () => {
    const { router, dispose } = setup();
    await settle();
    await router.navigate({ to: '/posts' });
    await settle();

    await openAuthorModal(router, '1');
    expect(presentedModals).toHaveLength(1);

    presentedModals[0].closeModal();
    await settle();
    expect(presentedModals).toHaveLength(0);
    expect(modalOf(router)).toBeUndefined();

    await openAuthorModal(router, '1');
    expect(presentedModals).toHaveLength(1);

    dispose();
  });

  it('pops the modal history entry on close so the next back leaves the page', async () => {
    const { router, frame, dispose } = setup();
    await settle();
    await router.navigate({ to: '/posts' });
    await settle();
    await openAuthorModal(router, '1');
    expect(historyIndex(router)).toBe(2);

    presentedModals[0].closeModal();
    await settle();
    expect(historyIndex(router)).toBe(1);
    expect(router.state.location.pathname).toBe('/posts');

    const args = pressHardwareBack();
    expect(args.cancel).toBe(true);
    await settle();
    expect(router.state.location.pathname).toBe('/');
    expect(frame.pagePaths()).toEqual(['/']);

    dispose();
  });

  it('opens a modal deep-linked from another page exactly once, on the new page', async () => {
    const { router, frame, dispose } = setup();
    await settle();

    await router.navigate({ to: '/posts', search: { '@modal': '/users/3' } });
    await settle();
    await settle();

    expect(presentedModals).toHaveLength(1);
    expect(presentedModals[0].modalHost).toBe(frame.currentPage);
    expect((frame.currentPage as any).__nsRouterPath).toBe('/posts');
    expect((frame.currentPage as FakePage).showModalCalls).toBe(1);

    // Its entry was not pushed on top of /posts, so closing keeps the page.
    presentedModals[0].closeModal();
    await settle();
    expect(router.state.location.pathname).toBe('/posts');
    expect(modalOf(router)).toBeUndefined();
    expect(frame.pagePaths()).toEqual(['/', '/posts']);

    dispose();
  });

  it('lets the dialog handle hardware back while a modal is presented', async () => {
    const { router, dispose } = setup();
    await settle();
    await router.navigate({ to: '/posts' });
    await settle();
    await openAuthorModal(router, '2');

    const args = pressHardwareBack();
    expect(args.cancel).toBe(false);
    expect(historyIndex(router)).toBe(2);

    // The dialog's default back handling dismisses it.
    presentedModals[0].closeModal();
    await settle();
    expect(router.state.location.pathname).toBe('/posts');
    expect(historyIndex(router)).toBe(1);

    dispose();
  });

  it('closes the modal when router history leaves the modal entry', async () => {
    const { router, dispose } = setup();
    await settle();
    await router.navigate({ to: '/posts' });
    await settle();
    await openAuthorModal(router, '1');
    expect(presentedModals).toHaveLength(1);

    router.history.back();
    await settle();
    expect(presentedModals).toHaveLength(0);
    expect(router.state.location.pathname).toBe('/posts');
    expect(historyIndex(router)).toBe(1);

    dispose();
  });

  it('never presents a modal whose route was left before it finished loading', async () => {
    const { router, dispose } = setup();
    await settle();
    await router.navigate({ to: '/posts' });
    await settle();

    void router.navigate({ to: '/posts', search: { '@modal': '/users/1' } });
    router.history.back();
    await settle();
    await settle();

    expect(presentedModals).toHaveLength(0);
    expect(modalOf(router)).toBeUndefined();

    dispose();
  });
});

describe('NativeScriptRouterProvider navigation while the Frame is locked', () => {
  it('applies a navigation that lands during a router back', async () => {
    const { router, frame, dispose } = setup();
    await settle();
    await router.navigate({ to: '/posts' });
    await settle();

    router.history.back();
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    await Promise.resolve();
    void router.navigate({ to: '/about' });
    await settle();
    await settle();

    expect(router.state.location.pathname).toBe('/about');
    expect(frame.pagePaths()).toEqual(['/', '/about']);

    dispose();
  });
});

describe('NativeScriptRouterProvider replace navigation', () => {
  it('drops the replaced page from the Frame backstack', async () => {
    const { router, frame, dispose } = setup();
    await settle();
    await router.navigate({ to: '/posts' });
    await settle();
    await router.navigate({ to: '/about', replace: true });
    await settle();
    expect(frame.pagePaths()).toEqual(['/', '/about']);

    pressHardwareBack();
    await settle();
    expect(router.state.location.pathname).toBe('/');
    expect(frame.pagePaths()).toEqual(['/']);

    dispose();
  });
});
