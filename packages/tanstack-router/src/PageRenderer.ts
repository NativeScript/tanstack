import { Errored, createComponent, createRoot, flush, runWithOwner, untrack } from 'solid-js';
import { insert } from '@nativescript-community/solid-js';
import { RouterContextProvider, type AnyRouter } from '@tanstack/solid-router';
import type { Component } from 'solid-js';
import { resetNativeBackSyncScheduled, shouldScheduleNativeBackSync } from './native-back-sync';
import { createDebugLogger } from './debug-log';
import { describeComponentShape, normalizeRenderableComponent } from './component-shape';
import { shouldUnmountPageOnNavigatingFrom } from './page-lifecycle';
import { NavigatedData } from '@nativescript/core';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  return String(err);
}

// Unlike the renderer's `render()`, disposing this root leaves the views attached,
// so a Page popped by native back keeps its content through the pop animation
// while its reactivity is already torn down.
function mountTree(parent: any, code: () => unknown): () => void {
  let dispose!: () => void;
  runWithOwner(null, () =>
    createRoot((d) => {
      dispose = d;
      const tree = code();
      insert(parent, () => tree);
    }),
  );
  flush();
  return dispose;
}

function isExpectedBackstackError(message: string): boolean {
  return message.includes('Cannot read properties of undefined') || message.includes('Could not find an active match');
}

export function renderPage(
  router: AnyRouter,
  RouteComponent: Component,
  routePath: string,
  onNativeBack?: (sourcePath: string) => void,
  onVisiblePathChange?: (visiblePath: string, isBackNavigation: boolean) => void,
  debug?: boolean,
  // Optional per-page chrome thunk (e.g. an <actionbar>). Called inside the page's
  // render scope so it participates in the same reactive lifecycle/disposal as the
  // route content. Whatever it returns is inserted as a child of the Page alongside
  // the route component — dominative's Page slots an ActionBar child into
  // `page.actionBar` and the route's root view into `page.content`. See
  // `NativeScriptRouterProvider`'s `actionBar` prop.
  chrome?: () => any,
): any {
  const page = document.createElement('Page') as any;
  const log = createDebugLogger(debug);

  let resetErrorBoundary: (() => void) | undefined;
  const loggedUnexpectedErrors = new Set<string>();
  let dispose: (() => void) | undefined;
  let hasMounted = false;
  let nativeBackSyncScheduled = false;
  // Track the current route component reference. HMR remount swaps this so a
  // freshly-imported route module's exported component takes effect on
  // subsequent mounts without the consumer needing to re-call renderPage.
  let currentRouteComponent: Component = RouteComponent;

  const getPagePath = () => (page as any).__nsRouterPath || routePath;

  // Reset error boundary when Page comes back from backstack
  page.on('loaded', () => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
      resetErrorBoundary = undefined;
    }
  });

  // Keep a stable path tag on the page for native navigation reconciliation.
  (page as any).__nsRouterPath = routePath;

  const mount = () => {
    if (dispose) return;

    if (typeof RouterContextProvider !== 'function') {
      console.error('[NSRouter] Invalid RouterContextProvider export:', describeComponentShape(RouterContextProvider));
      return;
    }

    if (typeof Errored !== 'function') {
      console.error('[NSRouter] Invalid Errored export:', describeComponentShape(Errored));
      return;
    }

    const SafeRouteView = () => {
      const Comp = normalizeRenderableComponent(currentRouteComponent);
      if (!Comp) {
        console.error('[NSRouter] Invalid render component for route path:', routePath, 'shape:', describeComponentShape(currentRouteComponent));
        return null as any;
      }

      try {
        return createComponent(Comp as any, {});
      } catch (err) {
        console.error('[NSRouter] Route component invocation failed for path:', routePath, 'shape:', describeComponentShape(currentRouteComponent), err);
        return null as any;
      }
    };

    if (hasMounted) {
      clearPageChildren();
    }
    hasMounted = true;

    dispose = mountTree(page, () =>
      createComponent(RouterContextProvider, {
        router,
        children: () => [
          // Per-page chrome (e.g. <actionbar>) rendered as a sibling of the route
          // content; dominative routes it to `page.actionBar`. null when no chrome.
          chrome ? chrome() : null,
          createComponent(Errored, {
            fallback: (err: () => unknown, reset: () => void) => {
              const error = untrack(err);
              const message = getErrorMessage(error);

              // Backstack pages can briefly evaluate stale route hooks while hidden.
              // This is expected and intentionally swallowed by rendering nothing.
              if (!isExpectedBackstackError(message) && !loggedUnexpectedErrors.has(message)) {
                loggedUnexpectedErrors.add(message);
                console.error('[NSRouter] Errored caught:', error);
              }

              resetErrorBoundary = reset;
              return null;
            },
            // A getter defers creation into the boundary so render errors are caught.
            get children() {
              return createComponent(SafeRouteView, {});
            },
          }),
        ],
      }),
    );

    log('[NSRouter] page mount:', (page as any).__nsRouterPath || routePath);
  };

  const unmount = () => {
    if (dispose) {
      dispose();
      dispose = undefined;
      log('[NSRouter] page unmount:', (page as any).__nsRouterPath || routePath);
    }
  };

  // Detach the views left behind by a disposed tree (see mountTree). A Page shows
  // one content view, so a fresh tree appended beside stale views never appears.
  const clearPageChildren = () => {
    try {
      let child: any = (page as any).firstChild;
      while (child) {
        const next = child.nextSibling;
        try {
          (page as any).removeChild?.(child);
        } catch (err) {
          log('[NSRouter] removeChild failed during remount clear:', err);
        }
        child = next;
      }
      // dominative's Page has no __dominative_onRemoveChild, so removing the
      // nodes leaves NS Core's `actionBar` / `content` slots pointing at the old
      // views. Null them so the next mount always takes the first-set path.
      try {
        (page as any).actionBar = null;
      } catch {}
      try {
        (page as any).content = null;
      } catch {}
    } catch (err) {
      log('[NSRouter] clearPageChildren failed:', err);
    }
  };

  // HMR entry point (see solid-hmr-remount.ts): swaps the route component in
  // place instead of `frame.navigate()`, which would push a history entry and
  // lose the user's place.
  (page as any).__ns_remount = (nextComponent?: Component) => {
    if (typeof nextComponent === 'function') {
      currentRouteComponent = nextComponent;
    }
    unmount();
    mount();
    log('[NSRouter] page remount:', (page as any).__nsRouterPath || routePath);
  };

  // Mount immediately for the page being navigated to.
  mount();

  // Re-mount when this page becomes visible again after back navigation.
  page.on('navigatedTo', (args: NavigatedData) => {
    nativeBackSyncScheduled = resetNativeBackSyncScheduled();
    onVisiblePathChange?.(getPagePath(), !!args?.isBackNavigation);
    // Deterministic lifecycle handling: once a Page is visible, it must have
    // an active view tree regardless of router pending/transient state.
    mount();
    log('[NSRouter] page navigatedTo:', getPagePath());
  });

  // Sync router when this page is popped by native UI back controls
  // (iOS ActionBar/UINavigationController back, swipe-back, Android native pop).
  page.on('navigatingFrom', (args: NavigatedData) => {
    const isBack = !!args?.isBackNavigation;

    // Tear down hidden page trees on both forward/back transitions.
    // When a page becomes visible again, `navigatedTo` re-mounts it.
    if (shouldUnmountPageOnNavigatingFrom(args)) {
      unmount();
    }

    // For native back pops, sync router history after unmount and on next tick
    // to avoid re-entrant updates in the native transition teardown stack.
    if (
      shouldScheduleNativeBackSync({
        isBackNavigation: isBack,
        alreadyScheduled: nativeBackSyncScheduled,
      })
    ) {
      nativeBackSyncScheduled = true;
      log('[NSRouter] schedule native back sync from:', getPagePath());
      setTimeout(() => {
        const sourcePath = getPagePath();
        log('[NSRouter] run native back sync from:', sourcePath);
        onNativeBack?.(sourcePath);
      }, 0);
    } else if (isBack) {
      log('[NSRouter] native back sync already scheduled for:', getPagePath());
    }

    log('[NSRouter] page navigatingFrom:', getPagePath(), 'isBack:', isBack);
  });

  // Clean up SolidJS tree when native Page is destroyed
  page.on('disposeNativeView', () => {
    nativeBackSyncScheduled = resetNativeBackSyncScheduled();
    unmount();
  });

  return page;
}
