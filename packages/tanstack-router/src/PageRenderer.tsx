import { ErrorBoundary, createComponent } from 'solid-js'
import { render } from '@nativescript-community/solid-js'
import { RouterContextProvider, type AnyRouter } from '@tanstack/solid-router'
import type { Component } from 'solid-js'
import {
  resetNativeBackSyncScheduled,
  shouldScheduleNativeBackSync,
} from './native-back-sync'
import { createDebugLogger } from './debug-log'
import { describeComponentShape, normalizeRenderableComponent } from './component-shape'
import { shouldUnmountPageOnNavigatingFrom } from './page-lifecycle'

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }

  return String(err)
}

function isExpectedBackstackError(message: string): boolean {
  return (
    message.includes("Cannot read properties of undefined") ||
    message.includes('Could not find an active match')
  )
}

export function renderPage(
  router: AnyRouter,
  RouteComponent: Component,
  routePath: string,
  onNativeBack?: (sourcePath: string) => void,
  onVisiblePathChange?: (visiblePath: string) => void,
  debug?: boolean,
): any {
  const page = document.createElement('Page') as any
  const log = createDebugLogger(debug)

  let resetErrorBoundary: (() => void) | undefined
  const loggedUnexpectedErrors = new Set<string>()
  let dispose: (() => void) | undefined
  let nativeBackSyncScheduled = false
  let remountTimer: ReturnType<typeof setTimeout> | undefined

  const clearRemountTimer = () => {
    if (remountTimer) {
      clearTimeout(remountTimer)
      remountTimer = undefined
    }
  }

  const getPagePath = () => (page as any).__nsRouterPath || routePath

  const remountWhenRouterPathSettles = (attempt = 0) => {
    clearRemountTimer()

    const pagePath = getPagePath()
    const activePath = router.state.location.pathname
    const isAligned = activePath === pagePath

    if (isAligned || !onNativeBack) {
      mount()
      return
    }

    if (attempt === 0) {
      log('[NSRouter] deferring page remount until router path settles:', 'page=', pagePath, 'active=', activePath)
    }

    remountTimer = setTimeout(() => remountWhenRouterPathSettles(attempt + 1), 0)
  }

  // Reset error boundary when Page comes back from backstack
  page.on('loaded', () => {
    if (resetErrorBoundary) {
      resetErrorBoundary()
      resetErrorBoundary = undefined
    }
  })

  // Keep a stable path tag on the page for native navigation reconciliation.
  ;(page as any).__nsRouterPath = routePath

  const mount = () => {
    if (dispose) return

    if (typeof RouterContextProvider !== 'function') {
      console.error('[NSRouter] Invalid RouterContextProvider export:', describeComponentShape(RouterContextProvider))
      return
    }

    if (typeof ErrorBoundary !== 'function') {
      console.error('[NSRouter] Invalid ErrorBoundary export:', describeComponentShape(ErrorBoundary))
      return
    }

    const SafeRouteView = () => {
      const Comp = normalizeRenderableComponent(RouteComponent)
      if (!Comp) {
        console.error(
          '[NSRouter] Invalid render component for route path:',
          routePath,
          'shape:',
          describeComponentShape(RouteComponent),
        )
        return null as any
      }

      try {
        return createComponent(Comp as any, {})
      } catch (err) {
        console.error(
          '[NSRouter] Route component invocation failed for path:',
          routePath,
          'shape:',
          describeComponentShape(RouteComponent),
          err,
        )
        return null as any
      }
    }

    dispose = render(
      () => (
        <RouterContextProvider router={router}>
          {() => (
            <ErrorBoundary
              fallback={(err: any, reset: () => void) => {
                const message = getErrorMessage(err)

                // Backstack pages can briefly evaluate stale route hooks while hidden.
                // This is expected and intentionally swallowed by rendering nothing.
                if (!isExpectedBackstackError(message) && !loggedUnexpectedErrors.has(message)) {
                  loggedUnexpectedErrors.add(message)
                  console.error('[NSRouter] ErrorBoundary caught:', err)
                }

                resetErrorBoundary = reset
                return null as any
              }}
            >
              <SafeRouteView />
            </ErrorBoundary>
          )}
        </RouterContextProvider>
      ),
      page,
    )

    log('[NSRouter] page mount:', (page as any).__nsRouterPath || routePath)
  }

  const unmount = () => {
    if (dispose) {
      dispose()
      dispose = undefined
      log('[NSRouter] page unmount:', (page as any).__nsRouterPath || routePath)
    }
  }

  // Mount immediately for the page being navigated to.
  mount()

  // Re-mount when this page becomes visible again after back navigation.
  page.on('navigatedTo', () => {
    nativeBackSyncScheduled = resetNativeBackSyncScheduled()
    onVisiblePathChange?.(getPagePath())
    remountWhenRouterPathSettles()
    log('[NSRouter] page navigatedTo:', getPagePath())
  })

  // Sync router when this page is popped by native UI back controls
  // (iOS ActionBar/UINavigationController back, swipe-back, Android native pop).
  page.on('navigatingFrom', (args: any) => {
    const isBack = !!args?.isBackNavigation

    // Tear down hidden page trees on both forward/back transitions.
    // When a page becomes visible again, `navigatedTo` re-mounts it.
    if (shouldUnmountPageOnNavigatingFrom(args)) {
      unmount()
    }

    // For native back pops, sync router history after unmount and on next tick
    // to avoid re-entrant updates in the native transition teardown stack.
    if (
      shouldScheduleNativeBackSync({
        isBackNavigation: isBack,
        alreadyScheduled: nativeBackSyncScheduled,
      })
    ) {
        nativeBackSyncScheduled = true
        log('[NSRouter] schedule native back sync from:', getPagePath())
        setTimeout(() => {
          const sourcePath = getPagePath()
          log('[NSRouter] run native back sync from:', sourcePath)
          onNativeBack?.(sourcePath)
        }, 0)
    } else if (isBack) {
      log('[NSRouter] native back sync already scheduled for:', getPagePath())
    }

    log('[NSRouter] page navigatingFrom:', getPagePath(), 'isBack:', isBack)
  })

  // Clean up SolidJS tree when native Page is destroyed
  page.on('disposeNativeView', () => {
    clearRemountTimer()
    nativeBackSyncScheduled = resetNativeBackSyncScheduled()
    unmount()
  })

  return page
}
