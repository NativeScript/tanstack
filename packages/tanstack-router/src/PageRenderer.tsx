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
import { NavigatedData } from '@nativescript/core'

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

// Unwrap a solid-refresh proxy chain to the underlying user component
// function. See `solid-hmr-remount.ts` for full reasoning — the short
// version is that mounting with the proxy creates a HMRComp createMemo
// subscribed to the M_initial signal, which in our universal-renderer +
// nested context provider configuration is the source of "every other
// save applies". Mounting with the underlying function is a clean,
// single-pass render with no signal-based reactivity for solid-refresh
// to interfere with.
function unwrapSolidRefreshProxyInline(value: any): any {
  if (typeof value !== 'function') return value
  let current: any = value
  let hops = 0
  while (typeof current?.__$ns_resolveSource === 'function' && hops < 8) {
    try {
      const next = current.__$ns_resolveSource()
      if (typeof next !== 'function' || next === current) break
      current = next
      hops++
    } catch {
      break
    }
  }
  return current
}

export function renderPage(
  router: AnyRouter,
  RouteComponent: Component,
  routePath: string,
  onNativeBack?: (sourcePath: string) => void,
  onVisiblePathChange?: (visiblePath: string) => void,
  debug?: boolean,
  // Optional per-page chrome thunk (e.g. an <actionbar>). Called inside the page's
  // render scope so it participates in the same reactive lifecycle/disposal as the
  // route content. Whatever it returns is inserted as a child of the Page alongside
  // the route component — dominative's Page slots an ActionBar child into
  // `page.actionBar` and the route's root view into `page.content`. See
  // `NativeScriptRouterProvider`'s `actionBar` prop.
  chrome?: () => any,
): any {
  const page = document.createElement('Page') as any
  const log = createDebugLogger(debug)

  let resetErrorBoundary: (() => void) | undefined
  const loggedUnexpectedErrors = new Set<string>()
  let dispose: (() => void) | undefined
  let nativeBackSyncScheduled = false
  // Track the current route component reference. HMR remount swaps this so a
  // freshly-imported route module's exported component takes effect on
  // subsequent mounts without the consumer needing to re-call renderPage.
  let currentRouteComponent: Component = RouteComponent

  const getPagePath = () => (page as any).__nsRouterPath || routePath

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
      // Unwrap solid-refresh proxies (M_save_X.proxy → M_initial.proxy → fn)
      // ALSO at boot (not just HMR remount). If we mount with the proxy, its
      // HMRComp body creates a createMemo subscribed to M_initial.source.
      // That subscription survives subsequent unmounts in subtle ways
      // (cleanNode unsubscribes, but the cached value held by the renderEffect
      // closure still references the previous JSX), and the next HMR cycle's
      // patchRegistry causes the previous mount's leftover memo to re-evaluate
      // BEFORE our remount fires — producing the visible "every other save
      // applies / always one save behind" symptom. By unwrapping here we
      // ensure devComponent calls the underlying user function directly with
      // no proxy chain at any mount, boot or HMR.
      const raw = normalizeRenderableComponent(currentRouteComponent)
      const Comp = unwrapSolidRefreshProxyInline(raw)
      if (!Comp) {
        console.error(
          '[NSRouter] Invalid render component for route path:',
          routePath,
          'shape:',
          describeComponentShape(currentRouteComponent),
        )
        return null as any
      }

      // Diagnostic: surface the proxy/component identity SafeRouteView is
      // about to render. Pairs with the inline patchRegistry diagnostics in
      // `@solid-refresh` ($$refreshESM) — together they make the
      // "did patchRegistry actually swap the signal AND did mount actually
      // render that swapped proxy?" question answerable from the device
      // console without instrumenting solid-js itself.
      try {
        const compName = (Comp as any).name || 'anonymous'
        const compTag = (Comp as any).location || ''
        log('[NSRouter] SafeRouteView render — component name=', compName, 'location=', compTag)
      } catch {}

      try {
        return createComponent(Comp as any, {})
      } catch (err) {
        console.error(
          '[NSRouter] Route component invocation failed for path:',
          routePath,
          'shape:',
          describeComponentShape(currentRouteComponent),
          err,
        )
        return null as any
      }
    }

    dispose = render(
      () => (
        <RouterContextProvider router={router}>
          {() => [
            // Per-page chrome (e.g. <actionbar>) rendered as a sibling of the route
            // content; dominative routes it to `page.actionBar`. null when no chrome.
            chrome ? chrome() : null,
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
            </ErrorBoundary>,
          ]}
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

  // Detach every child currently attached to the Page. Solid's `dispose()`
  // tears down reactive computations but does NOT remove DOM nodes — so a
  // naive unmount + mount leaves the old subtree attached and the new one
  // gets appended alongside it. NativeScript Pages can only display one
  // root content view at a time, so without this clear the new tree never
  // becomes visible (the user keeps seeing the stale render). Used only on
  // explicit remount paths (HMR), never during routine navigation.
  const clearPageChildren = () => {
    try {
      let child: any = (page as any).firstChild
      while (child) {
        const next = child.nextSibling
        try {
          ;(page as any).removeChild?.(child)
        } catch (err) {
          log('[NSRouter] removeChild failed during remount clear:', err)
        }
        child = next
      }
      // dominative's Page wrapper has no __dominative_onRemoveChild — undom
      // clears `page.childNodes` but NS Core's `Page._actionBar` and
      // `Page._content` references stay pointing at the previous mount's
      // elements. The next mount inserts NEW elements which trigger the
      // setters' identity check (different => replace), so this is usually
      // a no-op safety. But under HMR remount we've observed cases where the
      // NS view tree retains stale visible content even though the new
      // dominative tree was correctly built. Explicitly null out the slots
      // before the mount inserts fresh elements so the setters always take
      // the "first set" path (no comparison against a stale reference).
      try {
        ;(page as any).actionBar = null
      } catch {}
      try {
        ;(page as any).content = null
      } catch {}
    } catch (err) {
      log('[NSRouter] clearPageChildren failed:', err)
    }
  }

  // Expose a remount API so HMR-aware code (e.g.
  // `NativeScriptRouterProvider`'s solid-hmr subscriber) can swap in a
  // freshly-imported route component without going through
  // `frame.navigate()` (which would push a new history entry and lose the
  // user's place). When `nextComponent` is provided the page picks up that
  // reference on the next mount; otherwise it re-mounts with whatever
  // reference is currently held (useful when the proxy itself was patched
  // in place, e.g. solid-refresh).
  ;(page as any).__ns_remount = (nextComponent?: Component) => {
    if (typeof nextComponent === 'function') {
      // Diagnostic: surface whether nextComponent identity changes from
      // call to call. If the same proxy instance is passed across saves
      // AND solid-refresh's patchRegistry is functioning, the proxy's
      // internal signal source should still produce the latest body.
      try {
        const sameAsBefore = currentRouteComponent === nextComponent
        log('[NSRouter] __ns_remount component identity sameAsBefore=', sameAsBefore, 'name=', (nextComponent as any).name || 'anonymous')
      } catch {}
      currentRouteComponent = nextComponent
    }
    unmount()
    clearPageChildren()
    mount()
    log('[NSRouter] page remount:', (page as any).__nsRouterPath || routePath)
  }

  // Mount immediately for the page being navigated to.
  mount()

  // Re-mount when this page becomes visible again after back navigation.
  page.on('navigatedTo', () => {
    nativeBackSyncScheduled = resetNativeBackSyncScheduled()
    onVisiblePathChange?.(getPagePath())
    // Deterministic lifecycle handling: once a Page is visible, it must have
    // an active view tree regardless of router pending/transient state.
    mount()
    log('[NSRouter] page navigatedTo:', getPagePath())
  })

  // Sync router when this page is popped by native UI back controls
  // (iOS ActionBar/UINavigationController back, swipe-back, Android native pop).
  page.on('navigatingFrom', (args: NavigatedData) => {
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
    nativeBackSyncScheduled = resetNativeBackSyncScheduled()
    unmount()
  })

  return page
}
