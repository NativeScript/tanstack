import { describe, expect, it } from 'vitest';
import { doesRouteIdMatchPathname, getNativeScriptNavigationTransition, getNavigationSignalFromRouterState, ROUTER_STATE_INDEX_KEY, getHistoryIndex, getNavigationKind, shouldRunNativeBackSync, shouldSkipPathNavigation } from '../src/navigation-state';

describe('navigation-state helpers', () => {
  describe('getHistoryIndex', () => {
    it('returns index from history state key', () => {
      const state = { [ROUTER_STATE_INDEX_KEY]: 3 };
      expect(getHistoryIndex(state)).toBe(3);
    });

    it('defaults to 0 when missing', () => {
      expect(getHistoryIndex(undefined)).toBe(0);
      expect(getHistoryIndex({})).toBe(0);
      expect(getHistoryIndex({ [ROUTER_STATE_INDEX_KEY]: '2' })).toBe(0);
    });
  });

  describe('getNativeScriptNavigationTransition', () => {
    it('returns transition when present in history state', () => {
      const transition = { name: 'slide', duration: 250 };
      expect(
        getNativeScriptNavigationTransition({
          __nsNavigation: {
            transition,
          },
        }),
      ).toEqual(transition);
    });

    it('returns undefined when transition metadata is missing', () => {
      expect(getNativeScriptNavigationTransition(undefined)).toBeUndefined();
      expect(getNativeScriptNavigationTransition({})).toBeUndefined();
      expect(getNativeScriptNavigationTransition({ __nsNavigation: {} })).toBeUndefined();
    });
  });

  describe('shouldSkipPathNavigation', () => {
    it('skips when pathname unchanged and router has prior index', () => {
      expect(shouldSkipPathNavigation('/posts', '/posts', 1)).toBe(true);
    });

    it('does not skip when initial index', () => {
      expect(shouldSkipPathNavigation('/posts', '/posts', -1)).toBe(false);
    });

    it('does not skip when pathname changed', () => {
      expect(shouldSkipPathNavigation('/posts/3', '/posts', 1)).toBe(false);
    });
  });

  describe('getNavigationKind', () => {
    it('detects forward navigation', () => {
      expect(getNavigationKind(-1, 0)).toBe('forward');
      expect(getNavigationKind(1, 2)).toBe('forward');
    });

    it('detects replace navigation', () => {
      expect(getNavigationKind(2, 2)).toBe('replace');
    });

    it('detects back navigation', () => {
      expect(getNavigationKind(3, 2)).toBe('back');
    });
  });

  describe('shouldRunNativeBackSync', () => {
    it('runs only when guard is not active and history can go back', () => {
      expect(shouldRunNativeBackSync({ guardActive: false, canGoBack: true })).toBe(true);
      expect(shouldRunNativeBackSync({ guardActive: true, canGoBack: true })).toBe(false);
      expect(shouldRunNativeBackSync({ guardActive: false, canGoBack: false })).toBe(false);
    });
  });

  describe('getNavigationSignalFromRouterState', () => {
    it('builds signal from modal path and match ids', () => {
      expect(
        getNavigationSignalFromRouterState({
          status: 'idle',
          location: { search: { '@modal': '/users/1' } },
          matches: [{ id: 'root' }, { id: 'posts' }],
        }),
      ).toBe('/users/1|root,posts|idle');
    });

    it('returns stable value when modal is absent', () => {
      expect(
        getNavigationSignalFromRouterState({
          status: 'pending',
          location: { search: { q: 'abc' } },
          matches: [{ id: 'root' }],
        }),
      ).toBe('|root|pending');
    });

    it('normalizes relative modal path values', () => {
      expect(
        getNavigationSignalFromRouterState({
          status: 'idle',
          location: { search: { '@modal': 'users/2' } },
          matches: [{ id: 'root' }, { id: 'posts' }],
        }),
      ).toBe('/users/2|root,posts|idle');
    });

    it('treats whitespace-only modal values as closed', () => {
      expect(
        getNavigationSignalFromRouterState({
          status: 'idle',
          location: { search: { '@modal': '   ' } },
          matches: [{ id: 'root' }],
        }),
      ).toBe('|root|idle');
    });

    it('treats explicit false modal marker as closed', () => {
      expect(
        getNavigationSignalFromRouterState({
          status: 'idle',
          location: { search: { '@modal': 'false' } },
          matches: [{ id: 'root' }],
        }),
      ).toBe('|root|idle');
    });
  });

  describe('doesRouteIdMatchPathname', () => {
    it('matches static route ids exactly', () => {
      expect(doesRouteIdMatchPathname('/', '/')).toBe(true);
      expect(doesRouteIdMatchPathname('/posts', '/posts')).toBe(true);
      expect(doesRouteIdMatchPathname('/about', '/posts')).toBe(false);
    });

    it('matches dynamic segment route ids', () => {
      expect(doesRouteIdMatchPathname('/posts/$postId', '/posts/1')).toBe(true);
      expect(doesRouteIdMatchPathname('/users/$userId', '/users/123')).toBe(true);
      expect(doesRouteIdMatchPathname('/posts/$postId', '/posts')).toBe(false);
      expect(doesRouteIdMatchPathname('/posts/$postId', '/about/1')).toBe(false);
    });
  });
});
