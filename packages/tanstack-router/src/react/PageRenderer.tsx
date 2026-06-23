import { createElement } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { render } from '@nativescript-community/react';
import { RouterContextProvider, type AnyRouter } from '@tanstack/react-router';
import { resetNativeBackSyncScheduled, shouldScheduleNativeBackSync } from '../native-back-sync';
import { createDebugLogger } from '../debug-log';
import { describeComponentShape, normalizeRenderableComponent } from '../component-shape';
import { shouldUnmountPageOnNavigatingFrom } from '../page-lifecycle';
import { NavigatedData } from '@nativescript/core';
import { RouteErrorBoundary } from './ErrorBoundary';

const h = createElement;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function isExpectedBackstackError(message: string): boolean {
  return message.includes('Cannot read properties of undefined') || message.includes('Could not find an active match');
}

export function renderPage(
  router: AnyRouter,
  RouteComponent: ComponentType<any>,
  routePath: string,
  onNativeBack?: (sourcePath: string) => void,
  onVisiblePathChange?: (visiblePath: string) => void,
  debug?: boolean,
  // Optional per-page chrome thunk (e.g. an <actionbar>). Returns a React element
  // that's rendered as a sibling of the route content; dominative's Page routes an
  // ActionBar child into `page.actionBar` and the route root into `page.content`.
  chrome?: () => ReactNode,
): any {
  const page = document.createElement('Page') as any;
  const log = createDebugLogger(debug);

  let resetErrorBoundary: (() => void) | undefined;
  const loggedUnexpectedErrors = new Set<string>();
  let dispose: (() => void) | undefined;
  let nativeBackSyncScheduled = false;
  // Track the current route component reference. HMR remount swaps this so a
  // freshly-imported route module's exported component takes effect on
  // subsequent mounts without the consumer needing to re-call renderPage.
  let currentRouteComponent: ComponentType<any> = RouteComponent;

  const getPagePath = () => (page as any).__nsRouterPath || routePath;

  // Reset error boundary when Page comes back from backstack.
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

    const SafeRouteView = () => {
      const Comp = normalizeRenderableComponent(currentRouteComponent);
      if (!Comp) {
        console.error('[NSRouter] Invalid render component for route path:', routePath, 'shape:', describeComponentShape(currentRouteComponent));
        return null;
      }
      try {
        return h(Comp as ComponentType<any>);
      } catch (err) {
        console.error('[NSRouter] Route component invocation failed for path:', routePath, 'shape:', describeComponentShape(currentRouteComponent), err);
        return null;
      }
    };

    const tree = h(
      RouterContextProvider as any,
      { router },
      // Per-page chrome (e.g. <actionbar>) — dominative routes it to page.actionBar.
      chrome ? chrome() : null,
      h(
        RouteErrorBoundary,
        {
          fallback: (err: unknown, reset: () => void) => {
            const message = getErrorMessage(err);
            // Backstack pages can briefly evaluate stale route hooks while hidden.
            // This is expected and intentionally swallowed by rendering nothing.
            if (!isExpectedBackstackError(message) && !loggedUnexpectedErrors.has(message)) {
              loggedUnexpectedErrors.add(message);
              console.error('[NSRouter] ErrorBoundary caught:', err);
            }
            resetErrorBoundary = reset;
            return null;
          },
        },
        h(SafeRouteView),
      ),
    );

    dispose = render(tree, page);
    log('[NSRouter] page mount:', (page as any).__nsRouterPath || routePath);
  };

  const unmount = () => {
    if (dispose) {
      dispose();
      dispose = undefined;
      log('[NSRouter] page unmount:', (page as any).__nsRouterPath || routePath);
    }
  };

  // Detach every child currently attached to the Page. `dispose()` tears down the
  // React tree but a naive unmount+mount could leave the old subtree attached and
  // the new one appended alongside it; a NativeScript Page shows only one root
  // content view, so clear the slots before re-mounting. Used only on explicit
  // remount paths (HMR), never during routine navigation.
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

  // Expose a remount API so HMR-aware code can swap in a freshly-imported route
  // component without going through frame.navigate() (which would push history).
  (page as any).__ns_remount = (nextComponent?: ComponentType<any>) => {
    if (typeof nextComponent === 'function') {
      currentRouteComponent = nextComponent;
    }
    unmount();
    clearPageChildren();
    mount();
    log('[NSRouter] page remount:', (page as any).__nsRouterPath || routePath);
  };

  // Mount immediately for the page being navigated to.
  mount();

  // Re-mount when this page becomes visible again after back navigation.
  page.on('navigatedTo', () => {
    nativeBackSyncScheduled = resetNativeBackSyncScheduled();
    onVisiblePathChange?.(getPagePath());
    // Deterministic lifecycle: once a Page is visible it must have an active view
    // tree regardless of router pending/transient state.
    mount();
    log('[NSRouter] page navigatedTo:', getPagePath());
  });

  // Sync router when this page is popped by native UI back controls
  // (iOS ActionBar/UINavigationController back, swipe-back, Android native pop).
  page.on('navigatingFrom', (args: NavigatedData) => {
    const isBack = !!args?.isBackNavigation;

    if (shouldUnmountPageOnNavigatingFrom(args)) {
      unmount();
    }

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

  // Clean up the React tree when the native Page is destroyed.
  page.on('disposeNativeView', () => {
    nativeBackSyncScheduled = resetNativeBackSyncScheduled();
    unmount();
  });

  return page;
}
