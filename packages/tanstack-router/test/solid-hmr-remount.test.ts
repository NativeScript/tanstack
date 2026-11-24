import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { subscribeSolidHmrRemount } from '../src/solid-hmr-remount';

type Listener = (ev: { kind: 'solid'; changedFiles: string[]; boundaries: string[] }) => void;

class FakePage {
  public __nsRouterPath?: string;
  public __ns_remount = vi.fn<(next?: any) => void>();
  constructor(path?: string) {
    if (path) this.__nsRouterPath = path;
  }
}

class FakeFrame {
  public currentPage: FakePage | null = null;
  public backStack: any[] = [];
}

describe('subscribeSolidHmrRemount', () => {
  let listener: Listener | null;
  const log = vi.fn();

  beforeEach(() => {
    listener = null;
    log.mockReset();
    (globalThis as any).__ns_solid_hmr_subscribe = (fn: Listener) => {
      listener = fn;
      return () => {
        listener = null;
      };
    };
    delete (globalThis as any).__ns_solid_hmr_listener_set;
  });

  afterEach(() => {
    delete (globalThis as any).__ns_solid_hmr_subscribe;
    delete (globalThis as any).__ns_solid_hmr_listener_set;
  });

  it('falls back to direct listener set when no subscribe global is present', () => {
    delete (globalThis as any).__ns_solid_hmr_subscribe;
    const cleanup = subscribeSolidHmrRemount({
      router: {} as any,
      getFrame: () => null,
      log,
    });
    expect(cleanup).toBeTypeOf('function');
    const set = (globalThis as any).__ns_solid_hmr_listener_set as Set<Listener>;
    expect(set).toBeInstanceOf(Set);
    expect(set.size).toBe(1);
    cleanup();
    expect(set.size).toBe(0);
  });

  it('shared listener set still receives events when emit walks it directly', () => {
    delete (globalThis as any).__ns_solid_hmr_subscribe;
    const home = new FakePage('/');
    const frame = new FakeFrame();
    frame.currentPage = home;

    subscribeSolidHmrRemount({
      router: { routesById: {} } as any,
      getFrame: () => frame,
      log,
    });

    const set = (globalThis as any).__ns_solid_hmr_listener_set as Set<Listener>;
    for (const fn of set) {
      fn({ kind: 'solid', changedFiles: ['/src/components/home.tsx'], boundaries: [] });
    }
    expect(home.__ns_remount).toHaveBeenCalledTimes(1);
  });

  it('remounts every page on the Frame for any tsx change', () => {
    const home = new FakePage('/');
    const posts = new FakePage('/posts');
    const frame = new FakeFrame();
    frame.currentPage = posts;
    frame.backStack = [home];

    subscribeSolidHmrRemount({
      router: { routesById: {} } as any,
      getFrame: () => frame,
      log,
    });

    listener!({
      kind: 'solid',
      changedFiles: ['/src/components/home.tsx'],
      boundaries: [],
    });

    expect(home.__ns_remount).toHaveBeenCalledTimes(1);
    expect(posts.__ns_remount).toHaveBeenCalledTimes(1);
  });

  it('passes the freshly-patched component when a route file changed', () => {
    const home = new FakePage('/');
    const frame = new FakeFrame();
    frame.currentPage = home;

    const NewHome = () => null;
    const router = {
      routesById: {
        '/': { fullPath: '/', options: { component: NewHome } },
      },
    } as any;

    subscribeSolidHmrRemount({
      router,
      getFrame: () => frame,
      log,
    });

    listener!({
      kind: 'solid',
      changedFiles: ['/src/routes/index.tsx'],
      boundaries: ['/src/routes/index.tsx'],
    });

    expect(home.__ns_remount).toHaveBeenCalledTimes(1);
    expect(home.__ns_remount).toHaveBeenCalledWith(NewHome);
  });

  it('passes the freshly-patched component when a component file change propagates to a route file boundary', () => {
    // Mirrors the production HMR pipeline: editing
    // `/src/components/home.tsx` triggers the HMR client's BFS pass-2,
    // which discovers `/src/routes/index.tsx` (the route file that
    // imports home.tsx) as a boundary. The HMR client re-imports the
    // route file and patches `route.options.component` to the freshly-
    // imported reference. The listener then reads that fresh reference
    // and passes it through to the page remount — keeping the visible
    // tree in sync with the edited source even when solid-refresh's
    // proxy patch does not propagate to the page-level renderEffect.
    const home = new FakePage('/');
    const frame = new FakeFrame();
    frame.currentPage = home;

    const NewHome = () => null;
    const router = {
      routesById: {
        '/': { fullPath: '/', options: { component: NewHome } },
      },
    } as any;

    subscribeSolidHmrRemount({
      router,
      getFrame: () => frame,
      log,
    });

    listener!({
      kind: 'solid',
      changedFiles: ['/src/components/home.tsx'],
      boundaries: ['/src/components/home.tsx', '/src/routes/index.tsx'],
    });

    expect(home.__ns_remount).toHaveBeenCalledTimes(1);
    expect(home.__ns_remount).toHaveBeenCalledWith(NewHome);
  });

  it('remounts without a nextComponent for non-route .tsx changes', () => {
    const home = new FakePage('/');
    const frame = new FakeFrame();
    frame.currentPage = home;

    subscribeSolidHmrRemount({
      router: { routesById: {} } as any,
      getFrame: () => frame,
      log,
    });

    listener!({
      kind: 'solid',
      changedFiles: ['/src/components/shared.tsx'],
      boundaries: [],
    });

    expect(home.__ns_remount).toHaveBeenCalledTimes(1);
    expect(home.__ns_remount).toHaveBeenCalledWith(undefined);
  });

  it('skips remount entirely when no .tsx files changed', () => {
    const home = new FakePage('/');
    const frame = new FakeFrame();
    frame.currentPage = home;

    subscribeSolidHmrRemount({
      router: { routesById: {} } as any,
      getFrame: () => frame,
      log,
    });

    listener!({
      kind: 'solid',
      changedFiles: ['/src/styles.css'],
      boundaries: [],
    });

    expect(home.__ns_remount).not.toHaveBeenCalled();
  });

  it('also remounts the active modal page when present', () => {
    const home = new FakePage('/');
    const modal = new FakePage('/modal/share');
    const frame = new FakeFrame();
    frame.currentPage = home;

    subscribeSolidHmrRemount({
      router: { routesById: {} } as any,
      getFrame: () => frame,
      getActiveModalPage: () => modal,
      getActiveModalPath: () => '/modal/share',
      log,
    });

    listener!({
      kind: 'solid',
      changedFiles: ['/src/components/modal-content.tsx'],
      boundaries: [],
    });

    expect(home.__ns_remount).toHaveBeenCalledTimes(1);
    expect(modal.__ns_remount).toHaveBeenCalledTimes(1);
  });

  it('handles backStack entries wrapped in { entry, resolvedPage }', () => {
    const home = new FakePage('/');
    const posts = new FakePage('/posts');
    const frame = new FakeFrame();
    frame.currentPage = posts;
    frame.backStack = [{ entry: { resolvedPage: home } }];

    subscribeSolidHmrRemount({
      router: { routesById: {} } as any,
      getFrame: () => frame,
      log,
    });

    listener!({
      kind: 'solid',
      changedFiles: ['/src/components/home.tsx'],
      boundaries: [],
    });

    expect(home.__ns_remount).toHaveBeenCalledTimes(1);
    expect(posts.__ns_remount).toHaveBeenCalledTimes(1);
  });

  it('cleanup unsubscribes from the HMR client', () => {
    const home = new FakePage('/');
    const frame = new FakeFrame();
    frame.currentPage = home;

    const cleanup = subscribeSolidHmrRemount({
      router: { routesById: {} } as any,
      getFrame: () => frame,
      log,
    });

    cleanup();

    expect(listener).toBeNull();
  });

  it('catches handler errors so a flaky page does not break HMR for others', () => {
    const broken = new FakePage('/broken');
    broken.__ns_remount = vi.fn(() => {
      throw new Error('boom');
    });
    const fine = new FakePage('/fine');
    const frame = new FakeFrame();
    frame.currentPage = broken;
    frame.backStack = [fine];

    subscribeSolidHmrRemount({
      router: { routesById: {} } as any,
      getFrame: () => frame,
      log,
    });

    expect(() =>
      listener!({
        kind: 'solid',
        changedFiles: ['/src/components/home.tsx'],
        boundaries: [],
      }),
    ).not.toThrow();

    expect(broken.__ns_remount).toHaveBeenCalledTimes(1);
    expect(fine.__ns_remount).toHaveBeenCalledTimes(1);
  });
});
