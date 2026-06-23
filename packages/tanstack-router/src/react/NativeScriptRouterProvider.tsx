import { createElement, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { AnyRouter } from '@tanstack/react-router';
import { renderPage } from './PageRenderer';
import { setupBackHandler } from './back-handler';
import { doesRouteIdMatchPathname, getHistoryIndex, getNativeScriptNavigationTransition, getNavigationKind, shouldSkipPathNavigation } from '../navigation-state';
import { getNativeBackCallbackDecision } from '../native-back-sync';
import { createDebugLogger } from '../debug-log';
import { describeComponentShape, normalizeRenderableComponent } from '../component-shape';
import { subscribeReactHmrRemount } from './react-hmr-remount';
import type { NavigationGuard } from '../types';

const h = createElement;

/**
 * Context passed to {@link NativeScriptRouterProviderProps.actionBar} for the route
 * whose Page is about to be created.
 */
export interface NativeScriptPageActionBarContext {
  path: string;
  routeId: string;
  route: any;
  staticData: Record<string, any>;
}

export interface NativeScriptRouterProviderProps {
  router: AnyRouter;
  actionBarVisibility?: 'auto' | 'never' | 'always';
  animated?: boolean;
  transition?: { name?: string; duration?: number; curve?: any };
  debug?: boolean;
  /**
   * Optional per-page chrome — typically an `<actionbar>` — rendered into each
   * route's native Page. Return a React element (e.g. an `<actionbar>`) for the
   * matched route, or `null`/`undefined` for none.
   */
  actionBar?: (ctx: NativeScriptPageActionBarContext) => ReactNode;
}

/**
 * Native router host. Renders a `<frame>` and drives `Frame.navigate()` from the
 * shared NativeScript router's state.
 *
 * NOTE: This React port covers forward/replace/back navigation, native back-pop
 * sync, and per-page chrome. The modal state machine and the queued-native-back
 * drain from the Solid provider are intentionally deferred (not needed by the
 * base template) — see `@nativescript/tanstack-router/solid` for the full version.
 */
export function NativeScriptRouterProvider(props: NativeScriptRouterProviderProps) {
  const router = props.router;
  const frameRef = useRef<any>(null);

  // Mutable navigation bookkeeping (persists across renders / the effect).
  const stateRef = useRef({
    prevIndex: -1,
    prevPathname: '',
    suppressedNativeBackCallbacks: 0,
    skipNextFrameBackNavigation: false,
    nativeBackSyncInFlight: false,
    nativeBackSyncFromPath: null as string | null,
  });

  // Shared guard preventing circular updates between router and Frame.
  const guardRef = useRef<NavigationGuard>({ isNavigating: false });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      console.error('[NSRouter] frame ref not set; cannot drive navigation');
      return;
    }

    const log = createDebugLogger(props.debug);
    const guard = guardRef.current;
    const s = stateRef.current;

    // Ensure router stores are initialized (mirrors RouterContextProvider).
    try {
      router.update({
        ...router.options,
        context: { ...router.options.context },
      });
    } catch {}

    // Synchronous startTransition — no Suspense/concurrent transition needed; we
    // render Pages through Frame.navigate(), not a single mounted <Matches> tree.
    (router as any).startTransition = (fn: () => void) => {
      fn();
    };

    const releaseGuard = () => {
      guard.isNavigating = false;
      guard.lockReason = undefined;
      if (guard.lockTimeoutId) {
        clearTimeout(guard.lockTimeoutId);
        guard.lockTimeoutId = undefined;
      }
    };

    const acquireGuard = (reason: string) => {
      guard.isNavigating = true;
      guard.lockReason = reason;
      if (guard.lockTimeoutId) clearTimeout(guard.lockTimeoutId);
      // Failsafe: never let the navigation lock remain active indefinitely.
      guard.lockTimeoutId = setTimeout(() => {
        log('[NSRouter] force releasing stale guard:', guard.lockReason);
        releaseGuard();
      }, 250) as any;
    };

    const runNativeBackSync = () => {
      if (!router.history.canGoBack()) return;
      s.nativeBackSyncInFlight = true;
      s.nativeBackSyncFromPath = router.state.location.pathname;
      // Native UI has already popped the page. Reflect it in router history
      // without issuing a second Frame.goBack from the sync effect.
      s.skipNextFrameBackNavigation = true;
      acquireGuard('native_back_callback');
      log('[NSRouter] native back pop -> router.history.back()');
      router.history.back();
    };

    // ── Drive the Frame from current router state (forward / replace / back) ──
    const syncFrameToRouter = () => {
      if (!frame) return;
      const state = router.state;
      const matches = state.matches;
      if (!matches.length) return;

      // Release native-back sync lock once the router settles out of pending.
      if (s.nativeBackSyncInFlight && (state.status !== 'pending' || (s.nativeBackSyncFromPath != null && state.location.pathname !== s.nativeBackSyncFromPath))) {
        s.nativeBackSyncInFlight = false;
        s.nativeBackSyncFromPath = null;
        if (guard.lockReason === 'native_back_callback') {
          log('[NSRouter] native back callback releasing guard');
          releaseGuard();
        }
      }

      if (s.nativeBackSyncInFlight || guard.isNavigating) {
        return;
      }

      const curIndex = getHistoryIndex(router.history.location.state as any);
      const curTransition = getNativeScriptNavigationTransition(router.history.location.state);
      const curPathname = state.location.pathname;
      const hasPathChanged = !shouldSkipPathNavigation(curPathname, s.prevPathname, s.prevIndex);

      if (!hasPathChanged) {
        s.prevIndex = curIndex;
        return;
      }

      const navigationKind = getNavigationKind(s.prevIndex, curIndex);
      const isBack = navigationKind === 'back';
      const isReplace = navigationKind === 'replace';

      if (isBack) {
        if (s.skipNextFrameBackNavigation) {
          s.skipNextFrameBackNavigation = false;
          log('[NSRouter] skipping Frame.goBack for native-originated back sync');
          s.prevIndex = curIndex;
          s.prevPathname = curPathname;
          return;
        }

        acquireGuard('router_state_back');
        if (frame.canGoBack()) {
          // Router-initiated goBack causes a native navigatingFrom(back) event.
          // Suppress exactly one sync callback for this controlled pop.
          s.suppressedNativeBackCallbacks += 1;
          frame.goBack();
        }
        s.prevIndex = curIndex;
        s.prevPathname = curPathname;
        setTimeout(releaseGuard, 0);
        return;
      }

      // Forward or replace navigation: resolve the leaf route -> component.
      let leafMatch = matches[matches.length - 1];

      if (!doesRouteIdMatchPathname(leafMatch.routeId, curPathname)) {
        const routesById = (router as any).routesById || {};
        let resolvedRouteId: string | null = null;
        for (const routeId of Object.keys(routesById)) {
          if (routeId === '__root__') continue;
          if (doesRouteIdMatchPathname(routeId, curPathname)) {
            if (!resolvedRouteId || routeId.length > resolvedRouteId.length) {
              resolvedRouteId = routeId;
            }
          }
        }
        if (resolvedRouteId) {
          log('[NSRouter] match/path mismatch resolved:', leafMatch.routeId, '->', resolvedRouteId);
          leafMatch = { ...leafMatch, routeId: resolvedRouteId };
        } else {
          log('[NSRouter] deferring Frame navigation due to pending match/path mismatch:', leafMatch.routeId, curPathname);
          return;
        }
      }

      const route = (router as any).routesById[leafMatch.routeId];
      const rawComponent = route?.options?.component;
      const Component = normalizeRenderableComponent(rawComponent);

      if (!Component) {
        console.error('[NSRouter] Invalid route component for route:', leafMatch.routeId, 'shape:', describeComponentShape(rawComponent));
        s.prevIndex = curIndex;
        s.prevPathname = curPathname;
        return;
      }

      acquireGuard('router_state_forward_or_replace');

      const pageChrome = props.actionBar
        ? () =>
            props.actionBar!({
              path: curPathname,
              routeId: leafMatch.routeId,
              route,
              staticData: route?.options?.staticData ?? {},
            })
        : undefined;

      log('[NSRouter] navigating Frame to', curPathname);
      frame.navigate({
        create: () =>
          renderPage(
            router,
            Component as any,
            curPathname,
            (sourcePath: string) => {
              if (s.suppressedNativeBackCallbacks > 0) {
                s.suppressedNativeBackCallbacks -= 1;
                log('[NSRouter] native back callback suppressed (router-initiated goBack)');
                return;
              }
              const decision = getNativeBackCallbackDecision({
                guardActive: guard.isNavigating,
                canGoBack: router.history.canGoBack(),
              });
              if (decision === 'ignore_guard_active') {
                log('[NSRouter] native back callback ignored (guard active)');
                return;
              }
              if (decision === 'ignore_cannot_go_back') {
                log('[NSRouter] native back callback ignored (cannot go back)');
                return;
              }
              runNativeBackSync();
            },
            (visiblePath: string) => {
              // Visible-path change: keep prev-tracking aligned with what's on screen.
              s.prevPathname = visiblePath;
            },
            props.debug,
            pageChrome,
          ),
        animated: s.prevIndex >= 0 ? (props.animated ?? true) : false,
        transition: curTransition ?? props.transition,
        backstackVisible: !isReplace,
        clearHistory: false,
      });

      s.prevIndex = curIndex;
      s.prevPathname = curPathname;
      releaseGuard();
    };

    // ── Wire it up ──
    const unsubHistory = router.history.subscribe(() => {
      log('[NSRouter] history.subscribe fired, pathname:', router.state.location.pathname);
      const loadPromise = router.load();
      if (loadPromise && typeof loadPromise.then === 'function') {
        loadPromise.then(() => syncFrameToRouter()).catch((err: any) => log('[NSRouter] history load error:', err?.message || err));
      } else {
        syncFrameToRouter();
      }
    });

    const unsubResolved = router.subscribe('onResolved' as any, () => syncFrameToRouter());
    const unsubBeforeMount = router.subscribe('onBeforeRouteMount' as any, () => syncFrameToRouter());

    const cleanupBack = setupBackHandler(router, () => frame, guard);

    // HMR: when a route file changes, re-import it and remount the matching Page
    // in place (no Frame.navigate, so the user keeps their place). Shell/non-route
    // edits are handled by the app-runtime's re-import. No-op in production.
    const cleanupHmr = subscribeReactHmrRemount({ router, getFrame: () => frame, log });

    // Initial load -> render the initial route's Page.
    Promise.resolve(router.load())
      .then(() => {
        log('[NSRouter] initial load resolved. status:', router.state.status, 'matches:', router.state.matches.length);
        syncFrameToRouter();
      })
      .catch((err: any) => console.error('[NSRouter] initial load rejected:', err));

    return () => {
      unsubHistory();
      unsubResolved();
      unsubBeforeMount();
      cleanupBack();
      cleanupHmr();
      if (guard.lockTimeoutId) clearTimeout(guard.lockTimeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return h('frame', {
    ref: (el: any) => {
      frameRef.current = el;
    },
    actionBarVisibility: props.actionBarVisibility || 'never',
  });
}
