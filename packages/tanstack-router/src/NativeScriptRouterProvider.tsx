import { createEffect, onMount, onCleanup, startTransition, useTransition, untrack } from 'solid-js'
import { useStore } from '@tanstack/solid-store'
import type { AnyRouter } from '@tanstack/solid-router'
import { Color, Utils } from '@nativescript/core'
import { renderPage } from './PageRenderer'
import { setupBackHandler } from './back-handler'
import {
  doesRouteIdMatchPathname,
  getHistoryIndex,
  getNativeScriptNavigationTransition,
  getNavigationSignalFromRouterState,
  getNavigationKind,
  shouldSkipPathNavigation,
} from './navigation-state'
import { getNativeBackCallbackDecision } from './native-back-sync'
import { createDebugLogger } from './debug-log'
import type {
  NavigationGuard,
  NativeScriptModalOptionsResolver,
  NativeScriptModalPresentationOptions,
} from './types'
import { describeComponentShape, normalizeRenderableComponent } from './component-shape'
import { createNativeScriptRouter } from './router'
import { getSingleModalPathFromSearch, withSingleModalPath } from './modal-state'

export interface NativeScriptRouterProviderProps {
  router: AnyRouter
  actionBarVisibility?: 'auto' | 'never' | 'always'
  animated?: boolean
  transition?: { name?: string; duration?: number; curve?: any }
  debug?: boolean
  modalOptions?: NativeScriptModalPresentationOptions | NativeScriptModalOptionsResolver
}

export function NativeScriptRouterProvider(props: NativeScriptRouterProviderProps) {
  const router = props.router
  const log = createDebugLogger(props.debug)
  let frameRef: any
  let prevIndex = -1
  let prevPathname = ''
  let prevModalPath: string | null = null
  let activeModalPath: string | null = null
  let activeModalPage: any
  let modalLifecycleLock = false
  let modalRequestId = 0
  let suppressedNativeBackCallbacks = 0
  let nativeBackSyncInFlight = false
  let nativeBackSyncFromPath: string | null = null
  let nativeBackSyncTimeoutId: ReturnType<typeof setTimeout> | undefined
  let queuedNativeBackCount = 0
  let skipNextFrameBackNavigation = false
  // Shared guard to prevent circular updates between router and Frame
  const guard: NavigationGuard = { isNavigating: false }

  const releaseGuard = () => {
    guard.isNavigating = false
    guard.lockReason = undefined
    if (guard.lockTimeoutId) {
      clearTimeout(guard.lockTimeoutId)
      guard.lockTimeoutId = undefined
    }
  }

  const acquireGuard = (reason: string) => {
    guard.isNavigating = true
    guard.lockReason = reason
    if (guard.lockTimeoutId) {
      clearTimeout(guard.lockTimeoutId)
    }

    // Failsafe: never let navigation lock remain active indefinitely.
    guard.lockTimeoutId = setTimeout(() => {
      log('[NSRouter] force releasing stale guard:', guard.lockReason)
      releaseGuard()
    }, 250)
  }

  // Set up Solid transitions on the router (mirrors Transitioner.tsx)
  const [, startSolidTransition] = useTransition()
  router.startTransition = (fn: () => void) => {
    startTransition(() => {
      startSolidTransition(fn)
    })
  }

  // Reactive selector: track match IDs to detect route changes
  const navigationSignal = useStore(router.__store, (s: any) =>
    getNavigationSignalFromRouterState(s),
  )

  const closeModalFromRouterState = () => {
    if (!activeModalPage) {
      activeModalPath = null
      return
    }

    modalLifecycleLock = true
    const page = activeModalPage
    activeModalPage = undefined
    activeModalPath = null

    try {
      page.closeModal?.()
    } finally {
      setTimeout(() => {
        modalLifecycleLock = false
      }, 0)
    }
  }

  const syncRouterOnNativeModalClose = () => {
    if (modalLifecycleLock) {
      return
    }

    const currentModalPath = getSingleModalPathFromSearch(router.state.location.search)
    if (!currentModalPath) {
      return
    }

    acquireGuard('native_modal_close')
    router.navigate({
      to: '.',
      search: (prev: unknown) => withSingleModalPath(prev, null),
      replace: true,
    } as any)
    setTimeout(releaseGuard, 0)
  }

  const openModalFromRouterState = async (modalPath: string) => {
    const currentPage = frameRef?.currentPage
    if (!currentPage) {
      log('[NSRouter] modal open skipped (no currentPage) for path:', modalPath)
      return
    }

    const requestId = ++modalRequestId
    let modalPageRef: any
    const parentContext = (router as any).options?.context
    const modalContext =
      parentContext && typeof parentContext === 'object'
        ? { ...parentContext }
        : {}

    ;(modalContext as any).__nsModalController = {
      close: () => {
        modalPageRef?.closeModal?.()
      },
    }

    const modalRouter = createNativeScriptRouter({
      routeTree: router.routeTree as any,
      initialPath: modalPath,
      context: modalContext,
    } as any)

    try {
      await modalRouter.load()
    } catch (err) {
      console.error('[NSRouter] Modal router load failed for path:', modalPath, err)
      syncRouterOnNativeModalClose()
      return
    }

    if (requestId !== modalRequestId) {
      return
    }

    const modalMatches = modalRouter.state.matches
    const leafMatch = modalMatches[modalMatches.length - 1]
    if (!leafMatch) {
      console.error('[NSRouter] No modal match found for path:', modalPath)
      syncRouterOnNativeModalClose()
      return
    }

    const route = (modalRouter as any).routesById[leafMatch.routeId]
    const rawComponent = route?.options?.component
    const Component = normalizeRenderableComponent(rawComponent)

    if (!Component) {
      console.error(
        '[NSRouter] Invalid modal route component for route:',
        leafMatch.routeId,
        'shape:',
        describeComponentShape(rawComponent),
        'value:',
        rawComponent,
      )
      syncRouterOnNativeModalClose()
      return
    }

    const modalPage = renderPage(modalRouter, Component, modalPath, undefined, undefined, props.debug)
    modalPageRef = modalPage

    const resolvedModalOptions = typeof props.modalOptions === 'function'
      ? props.modalOptions({ modalPath, routeId: leafMatch.routeId })
      : props.modalOptions

    const resolvedIOSOptions = resolvedModalOptions?.ios
    const detentNames = resolvedIOSOptions?.detents ?? ['medium', 'large']
    const selectedDetent = resolvedIOSOptions?.selectedDetent ?? 'medium'
    const showGrabber = resolvedIOSOptions?.prefersGrabberVisible ?? true
    const expandsOnScroll = resolvedIOSOptions?.prefersScrollingExpandsWhenScrolledToEdge ?? false
    const edgeAttachedCompact = resolvedIOSOptions?.prefersEdgeAttachedInCompactHeight ?? false
    const cornerRadius = resolvedIOSOptions?.preferredCornerRadius ?? 20
    const transparentOnIOS26 = resolvedIOSOptions?.transparentBackgroundOnIOS26 ?? true
    const presentationStyle =
      resolvedIOSOptions?.presentationStyle ?? UIModalPresentationStyle.PageSheet

    const detents = detentNames
      .map((name) => {
        if (name === 'large') {
          return UISheetPresentationControllerDetent.largeDetent()
        }

        return UISheetPresentationControllerDetent.mediumDetent()
      })
      .filter(Boolean)

    const configureIOSModalSheet = () => {
      if (!__IOS__) {
        return
      }

      const vc = modalPage?.ios || modalPage?.viewController
      if (!vc) {
        return
      }

      vc.modalPresentationStyle = presentationStyle

      const sheet = vc.sheetPresentationController || vc.parentViewController?.sheetPresentationController
      if (!sheet) {
        return
      }

      if (detents.length) {
        sheet.detents = Utils.ios.collections.jsArrayToNSArray(detents)
      }

      sheet.selectedDetentIdentifier =
        selectedDetent === 'large'
          ? UISheetPresentationControllerDetentIdentifierLarge
          : UISheetPresentationControllerDetentIdentifierMedium
      sheet.prefersScrollingExpandsWhenScrolledToEdge = expandsOnScroll
      sheet.prefersEdgeAttachedInCompactHeight = edgeAttachedCompact
      sheet.prefersGrabberVisible = showGrabber
      sheet.preferredCornerRadius = cornerRadius

      // iOS 26+ allows transparent backgrounds so system material can show through.
      if (transparentOnIOS26 && Number(Utils.SDK_VERSION) >= 26) {
        modalPage.backgroundColor = new Color('transparent')
        if (vc.view) {
          vc.view.backgroundColor = UIColor.clearColor
        }
      }
    }

    activeModalPage = modalPage
    activeModalPath = modalPath
    currentPage.showModal(modalPage, {
      animated: resolvedModalOptions?.animated ?? (props.animated ?? true),
      fullscreen: resolvedModalOptions?.fullscreen ?? __ANDROID__,
      ios: {
        presentationStyle,
      },
      closeCallback: () => {
        if (activeModalPage === modalPage) {
          activeModalPage = undefined
          activeModalPath = null
        }
        syncRouterOnNativeModalClose()
      },
    })

    setTimeout(() => {
      try {
        configureIOSModalSheet()
      } catch (err) {
        console.error('[NSRouter] Failed to configure iOS modal sheet:', err)
      }
    }, 0)
  }

  const runNativeBackSync = () => {
    if (!router.history.canGoBack()) {
      queuedNativeBackCount = 0
      return
    }

    nativeBackSyncInFlight = true
    nativeBackSyncFromPath = router.state.location.pathname
    // Native UI has already popped the page. Reflect it in router history
    // without issuing a second Frame.goBack from the router effect.
    skipNextFrameBackNavigation = true
    acquireGuard('native_back_callback')
    log('[NSRouter] native back pop -> router.history.back()')
    router.history.back()

    if (nativeBackSyncTimeoutId) {
      clearTimeout(nativeBackSyncTimeoutId)
    }

    // Failsafe: if router state does not settle quickly, unlock and continue.
    nativeBackSyncTimeoutId = setTimeout(() => {
      if (!nativeBackSyncInFlight) {
        return
      }

      log('[NSRouter] native back sync timeout; forcing in-flight release')
      nativeBackSyncInFlight = false
      nativeBackSyncFromPath = null
      if (guard.lockReason === 'native_back_callback') {
        releaseGuard()
      }
      setTimeout(tryDrainQueuedNativeBack, 0)
    }, 250)
  }

  const reconcileRouterToVisiblePath = (visiblePath: string) => {
    const activePath = router.state.location.pathname
    if (visiblePath === activePath) {
      return
    }

    log(
      '[NSRouter] reconciling router to visible native page:',
      'visible=',
      visiblePath,
      'active=',
      activePath,
    )

    nativeBackSyncInFlight = false
    nativeBackSyncFromPath = null
    queuedNativeBackCount = 0
    skipNextFrameBackNavigation = false
    if (nativeBackSyncTimeoutId) {
      clearTimeout(nativeBackSyncTimeoutId)
      nativeBackSyncTimeoutId = undefined
    }

    acquireGuard('native_visible_path_reconcile')
    router.navigate({
      to: visiblePath,
      replace: true,
    } as any)
    setTimeout(releaseGuard, 0)
  }

  const tryDrainQueuedNativeBack = () => {
    if (queuedNativeBackCount <= 0) {
      return
    }

    if (nativeBackSyncInFlight || guard.isNavigating) {
      return
    }

    if (!router.history.canGoBack()) {
      queuedNativeBackCount = 0
      return
    }

    queuedNativeBackCount -= 1
    log('[NSRouter] draining queued native back sync. remaining:', queuedNativeBackCount)
    runNativeBackSync()
  }

  onMount(() => {
    // Subscribe to history changes and trigger router loading (like Transitioner)
    const unsub = router.history.subscribe(router.load)

    log('[NSRouter] onMount: calling router.load()')
    log('[NSRouter] latestLocation:', JSON.stringify(router.latestLocation?.pathname))
    log('[NSRouter] routeTree:', !!router.routeTree)
    log('[NSRouter] routesById keys:', Object.keys((router as any).routesById || {}))

    // Initial load
    const loadPromise = router.load()
    if (loadPromise && typeof loadPromise.then === 'function') {
      loadPromise.then(() => {
        log('[NSRouter] load resolved. status:', router.state.status, 'matches:', router.state.matches.length, 'pending:', router.state.pendingMatches?.length)
      }).catch((err: any) => {
        console.error('[NSRouter] load rejected:', err)
      })
    }

    // Set up back button handling
    const cleanupBack = setupBackHandler(router, () => frameRef, guard)

    onCleanup(() => {
      if (nativeBackSyncTimeoutId) {
        clearTimeout(nativeBackSyncTimeoutId)
        nativeBackSyncTimeoutId = undefined
      }
      closeModalFromRouterState()
      unsub()
      cleanupBack()
    })
  })

  // React to match changes and navigate the Frame
  createEffect(() => {
    // Read reactive dependency
    const _navigationSignal = navigationSignal()

    log('[NSRouter] effect fired, navigationSignal:', _navigationSignal, 'frameRef:', !!frameRef)

    untrack(() => {
      if (!frameRef) { log('[NSRouter] no frameRef'); return }
      const state = router.state
      const matches = state.matches
      log('[NSRouter] matches:', matches.length, 'status:', state.status)
      if (!matches.length) return

      // Release native-back sync lock only after router settles out of pending.
      if (
        nativeBackSyncInFlight &&
        (state.status !== 'pending' ||
          (nativeBackSyncFromPath != null && state.location.pathname !== nativeBackSyncFromPath))
      ) {
        nativeBackSyncInFlight = false
        nativeBackSyncFromPath = null
        if (nativeBackSyncTimeoutId) {
          clearTimeout(nativeBackSyncTimeoutId)
          nativeBackSyncTimeoutId = undefined
        }
        if (guard.lockReason === 'native_back_callback') {
          log('[NSRouter] native back callback releasing guard')
          releaseGuard()
        }
      }

      // Drain queued native-back requests one-by-one when router is stable.
      if (queuedNativeBackCount > 0) {
        tryDrainQueuedNativeBack()
      }

      if (nativeBackSyncInFlight || guard.isNavigating) {
        return
      }

      const curIndex = getHistoryIndex((router.history.location.state as any))
      const curTransition = getNativeScriptNavigationTransition(router.history.location.state)
      const curPathname = state.location.pathname
      const curModalPath = getSingleModalPathFromSearch(state.location.search)
      const hasPathChanged = !shouldSkipPathNavigation(curPathname, prevPathname, prevIndex)

      if (curModalPath !== prevModalPath) {
        if (!curModalPath) {
          closeModalFromRouterState()
          prevModalPath = curModalPath
        } else if (!activeModalPath) {
          // Defer opening modal until the base path is settled on the active page.
          if (hasPathChanged && prevPathname) {
            log('[NSRouter] deferring modal open until pathname settles:', curModalPath)
          } else {
            void openModalFromRouterState(curModalPath)
            prevModalPath = curModalPath
          }
        } else if (activeModalPath !== curModalPath) {
          closeModalFromRouterState()
          void openModalFromRouterState(curModalPath)
          prevModalPath = curModalPath
        }
      }

      if (guard.isNavigating) {
        log('[NSRouter] guard active; syncing prev tracking only. reason:', guard.lockReason)
        prevIndex = curIndex
        prevPathname = curPathname
        return
      }

      log('[NSRouter] curPathname:', curPathname, 'prevPathname:', prevPathname, 'curIndex:', curIndex, 'prevIndex:', prevIndex)

      // Skip if the pathname hasn't changed (e.g., only search params changed)
      if (!hasPathChanged) {
        prevIndex = curIndex
        return
      }

      const navigationKind = getNavigationKind(prevIndex, curIndex)
      const isBack = navigationKind === 'back'
      const isReplace = navigationKind === 'replace'

      if (isBack) {
        if (skipNextFrameBackNavigation) {
          skipNextFrameBackNavigation = false
          log('[NSRouter] skipping Frame.goBack for native-originated back sync')
          prevIndex = curIndex
          prevPathname = curPathname
          return
        }

        acquireGuard('router_state_back')
        if (frameRef.canGoBack()) {
          // Router-initiated goBack causes a native navigatingFrom(back) event.
          // Suppress exactly one sync callback for this controlled pop.
          suppressedNativeBackCallbacks += 1
          frameRef.goBack()
        }
        prevIndex = curIndex
        prevPathname = curPathname
        setTimeout(releaseGuard, 0)
        return
      }

      // Forward or replace navigation
      const leafMatch = matches[matches.length - 1]

      if (!doesRouteIdMatchPathname(leafMatch.routeId, curPathname)) {
        log(
          '[NSRouter] deferring Frame navigation due to pending match/path mismatch:',
          'routeId=',
          leafMatch.routeId,
          'pathname=',
          curPathname,
          'status=',
          state.status,
        )
        return
      }

      const route = (router as any).routesById[leafMatch.routeId]
      const rawComponent = route?.options?.component
      const Component = normalizeRenderableComponent(rawComponent)

      log('[NSRouter] leafMatch:', leafMatch.routeId, 'Component:', !!Component)

      if (!Component) {
        console.error(
          '[NSRouter] Invalid route component for route:',
          leafMatch.routeId,
          'shape:',
          describeComponentShape(rawComponent),
          'value:',
          rawComponent,
        )
        prevIndex = curIndex
        prevPathname = curPathname
        return
      }

      acquireGuard('router_state_forward_or_replace')

      log('[NSRouter] navigating Frame to', curPathname)
      frameRef.navigate({
        create: () => renderPage(router, Component, curPathname, (sourcePath) => {
          if (suppressedNativeBackCallbacks > 0) {
            suppressedNativeBackCallbacks -= 1
            log('[NSRouter] native back callback suppressed (router-initiated goBack)')
            return
          }

          // A stale source path still indicates a real native pop event.
          // This happens when multiple native pops occur while router state is
          // still settling. Queue the sync instead of dropping it.
          if (sourcePath !== router.state.location.pathname) {
            queuedNativeBackCount += 1
            log(
              '[NSRouter] queued native back sync (stale source path):',
              'source=',
              sourcePath,
              'active=',
              router.state.location.pathname,
              'count=',
              queuedNativeBackCount,
            )
            setTimeout(tryDrainQueuedNativeBack, 0)
            return
          }

          if (nativeBackSyncInFlight) {
            queuedNativeBackCount += 1
            log(
              '[NSRouter] queued native back sync while router is busy. count=',
              queuedNativeBackCount,
              'status=',
              router.state.status,
            )
            setTimeout(tryDrainQueuedNativeBack, 0)
            return
          }

          log('[NSRouter] native back callback. guard:', guard.isNavigating, 'path:', router.state.location.pathname)
          const decision = getNativeBackCallbackDecision({
            guardActive: guard.isNavigating,
            canGoBack: router.history.canGoBack(),
          })
          if (decision === 'ignore_guard_active') {
            queuedNativeBackCount += 1
            log('[NSRouter] queued native back sync (guard active). count=', queuedNativeBackCount)
            setTimeout(tryDrainQueuedNativeBack, 0)
            return
          }

          if (decision === 'ignore_cannot_go_back') {
            log('[NSRouter] native back callback ignored (cannot go back)')
            queuedNativeBackCount = 0
            return
          }

          runNativeBackSync()
        }, reconcileRouterToVisiblePath, props.debug),
        animated: prevIndex >= 0 ? (props.animated ?? true) : false,
        transition: curTransition ?? props.transition,
        backstackVisible: !isReplace,
        clearHistory: false,
      })

      prevIndex = curIndex
      prevPathname = curPathname

      // If a modal path is present on a path transition, open it after the
      // new page has a chance to become current.
      if (curModalPath && !activeModalPath) {
        setTimeout(() => {
          const latestModalPath = getSingleModalPathFromSearch(router.state.location.search)
          if (!latestModalPath || latestModalPath !== curModalPath || activeModalPath) {
            return
          }

          void openModalFromRouterState(latestModalPath)
          prevModalPath = latestModalPath
        }, 0)
      }

      releaseGuard()
    })
  })

  const frameEl = document.createElement('frame') as any
  frameRef = frameEl
  frameEl.setAttribute('actionBarVisibility', props.actionBarVisibility || 'never')
  return frameEl
}
