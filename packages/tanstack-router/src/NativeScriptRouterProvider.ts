import { createEffect, createSignal, onSettled, runWithOwner, untrack } from 'solid-js';
import type { Element as SolidElement } from 'solid-js';
import type { AnyRouter } from '@tanstack/solid-router';
import { Color, ShowModalOptions, Utils } from '@nativescript/core';
import { renderPage } from './PageRenderer';
import { setupBackHandler } from './back-handler';
import { doesRouteIdMatchPathname, getHistoryIndex, getHistoryKey, getNativeScriptNavigationTransition, getNavigationSignalFromRouterState, getNavigationKind, shouldSkipPathNavigation } from './navigation-state';
import { getNativeBackCallbackDecision, shouldCompleteNativeBackSyncOnVisiblePath } from './native-back-sync';
import { createDebugLogger } from './debug-log';
import type { NavigationGuard, NativeScriptModalOptionsResolver, NativeScriptModalPresentationOptions } from './types';
import { describeComponentShape, normalizeRenderableComponent } from './component-shape';
import { createDetachedNativeScriptRouter } from './router';
import { getSingleModalPathFromSearch, withSingleModalPath } from './modal-state';
import { subscribeSolidHmrRemount } from './solid-hmr-remount';
import { installNativeScriptStartTransition } from './start-transition';

/**
 * Context passed to {@link NativeScriptRouterProviderProps.actionBar} for the route
 * whose Page is about to be created.
 */
export interface NativeScriptPageActionBarContext {
  /** Resolved pathname for the page being created (e.g. `"/about"`). */
  path: string;
  /** Matched leaf route id. */
  routeId: string;
  /** The matched route object (`router.routesById[routeId]`). */
  route: any;
  /** The route's `staticData` route option, or `{}` when none was declared. */
  staticData: Record<string, any>;
}

export interface NativeScriptRouterProviderProps {
  router: AnyRouter;
  actionBarVisibility?: 'auto' | 'never' | 'always';
  animated?: boolean;
  transition?: { name?: string; duration?: number; curve?: any };
  debug?: boolean;
  modalOptions?: NativeScriptModalPresentationOptions | NativeScriptModalOptionsResolver;
  /**
   * Optional per-page chrome — typically an `<actionbar>` — rendered into each route's
   * native Page. Return an `<actionbar>` for the matched route and dominative slots it
   * into `page.actionBar`, so iOS/visionOS show a native back button automatically on
   * pushed pages; return `null`/`undefined` for no bar. Receives the matched route and
   * its `staticData`, so titles/items can be derived per route. With this, the app no
   * longer needs a persistent header above the Frame — each page owns its own bar.
   */
  actionBar?: (ctx: NativeScriptPageActionBarContext) => SolidElement;
}

const MAX_MISMATCH_RETRIES = 20;

export function NativeScriptRouterProvider(props: NativeScriptRouterProviderProps) {
  const router = props.router;

  // Mirrors RouterContextProvider. Detached from the component owner because the
  // update may write router stores, which Solid forbids inside owned scopes.
  runWithOwner(null, () => {
    router.update({
      ...router.options,
      context: {
        ...router.options.context,
      },
    });
  });

  const log = createDebugLogger(props.debug);
  let frameRef: any;
  let prevIndex = -1;
  let prevPathname = '';
  // Modal the provider is opening or presenting; null when none is wanted.
  let modalTargetPath: string | null = null;
  let activeModalPath: string | null = null;
  let activeModalPage: any;
  let modalRequestId = 0;
  // History key of the entry whose modal the user just dismissed natively, so the
  // modal is not reopened before the router has dropped it from that entry.
  let dismissedModalHistoryKey: string | null = null;
  // History entries seen so far, by index. Memory history exposes no entry list,
  // and closing a modal needs to know whether the entry below it is its own page.
  const seenHistoryEntries: Array<{ pathname: string; modalPath: string | null } | undefined> = [];
  let suppressedNativeBackCallbacks = 0;
  let nativeBackSyncInFlight = false;
  let nativeBackSyncFromPath: string | null = null;
  let queuedNativeBackCount = 0;
  let skipNextFrameBackNavigation = false;
  let routerGoBackPending = false;
  let syncQueued = false;
  let resyncWhenUnlocked = false;
  let mismatchRetries = 0;
  let mismatchRetryPath: string | null = null;
  let disposed = false;
  // Shared guard to prevent circular updates between router and Frame
  const guard: NavigationGuard = { isNavigating: false };

  // Router state is reconciled against the Frame as a whole, so coalescing and
  // re-running a sync is always safe.
  const scheduleSync = () => {
    if (syncQueued || disposed) {
      return;
    }
    syncQueued = true;
    queueMicrotask(() => {
      syncQueued = false;
      syncFrameToRouterState();
    });
  };

  const releaseGuard = () => {
    guard.isNavigating = false;
    guard.lockReason = undefined;
    if (guard.lockTimeoutId) {
      clearTimeout(guard.lockTimeoutId);
      guard.lockTimeoutId = undefined;
    }
    // Router changes that arrived while locked were not applied to the Frame.
    if (resyncWhenUnlocked) {
      resyncWhenUnlocked = false;
      scheduleSync();
    }
  };

  const acquireGuard = (reason: string) => {
    guard.isNavigating = true;
    guard.lockReason = reason;
    if (guard.lockTimeoutId) {
      clearTimeout(guard.lockTimeoutId);
    }

    // Failsafe: never let navigation lock remain active indefinitely.
    guard.lockTimeoutId = setTimeout(() => {
      log('[NSRouter] force releasing stale guard:', guard.lockReason);
      releaseGuard();
    }, 250);
  };

  installNativeScriptStartTransition(router);

  // Includes pathname so child-route swaps inside a layout (e.g. /virtual →
  // /virtual/inspector) register even when the match ids lag behind, and the
  // history entry key so moving between entries that look alike still syncs.
  const readNavigationKey = () => {
    const state = router.state;
    return `${getNavigationSignalFromRouterState(state)}:${state.location?.pathname || ''}:${getHistoryKey(state.location?.state)}`;
  };

  // Seeded once, then driven only by the router subscriptions below so Frame
  // sync follows router events rather than every intermediate store write.
  // Router events fire from load/transition callbacks with no stable owner, so
  // this internal signal opts into owned writes.
  const [navigationSignal, setNavigationSignal] = createSignal(untrack(readNavigationKey), { ownedWrite: true });

  const updateSignal = () => {
    setNavigationSignal(readNavigationKey());
  };

  const unsubLoad = router.subscribe('onLoad' as any, () => {
    updateSignal();
  });

  const unsubBeforeLoad = router.subscribe('onBeforeRouteMount' as any, () => {
    updateSignal();
  });

  const unsubResolved = router.subscribe('onResolved' as any, () => {
    updateSignal();
  });

  // The modal page's close callback ignores closes started here: it only syncs
  // the router for the presented page, which this clears first.
  const closeModalFromRouterState = () => {
    // Also cancels an open that is still loading.
    modalRequestId += 1;
    modalTargetPath = null;
    const page = activeModalPage;
    activeModalPage = undefined;
    activeModalPath = null;

    if (!page) {
      return;
    }

    try {
      page.closeModal?.();
    } catch (err) {
      console.error('[NSRouter] Failed to close modal:', err);
    }
  };

  // The user dismissed the modal natively (Close link, Android back, iOS swipe),
  // or it could not be shown. Drop it from router state: pop its history entry
  // when that entry was pushed over the same page, so Back is not spent on a
  // duplicate; otherwise remove the search param in place.
  const syncRouterOnNativeModalClose = (modalPath: string) => {
    const location = router.state.location;
    if (getSingleModalPathFromSearch(location.search) !== modalPath) {
      return;
    }

    dismissedModalHistoryKey = getHistoryKey(location.state);
    const entryBelow = seenHistoryEntries[getHistoryIndex(location.state) - 1];

    if (entryBelow && entryBelow.pathname === location.pathname && !entryBelow.modalPath && router.history.canGoBack()) {
      log('[NSRouter] native modal close -> popping modal history entry');
      router.history.back();
      return;
    }

    log('[NSRouter] native modal close -> removing modal search param');
    router.navigate({
      to: '.',
      search: (prev: unknown) => withSingleModalPath(prev, null),
      replace: true,
    } as any);
  };

  const abandonModalOpen = (modalPath: string) => {
    if (modalTargetPath === modalPath) {
      modalTargetPath = null;
    }
    syncRouterOnNativeModalClose(modalPath);
  };

  const openModalFromRouterState = async (modalPath: string) => {
    const currentPage = frameRef?.currentPage;
    if (!currentPage) {
      log('[NSRouter] modal open skipped (no currentPage) for path:', modalPath);
      return;
    }

    const requestId = ++modalRequestId;
    const isCurrentRequest = () => requestId === modalRequestId && !disposed;
    let modalPageRef: any;
    const parentContext = (router as any).options?.context;
    const modalContext = parentContext && typeof parentContext === 'object' ? { ...parentContext } : {};

    (modalContext as any).__nsModalController = {
      close: () => {
        modalPageRef?.closeModal?.();
      },
    };

    const modalRouter = createDetachedNativeScriptRouter({
      routeTree: router.routeTree as any,
      initialPath: modalPath,
      context: modalContext,
    } as any);
    installNativeScriptStartTransition(modalRouter);

    try {
      await modalRouter.load();
    } catch (err) {
      console.error('[NSRouter] Modal router load failed for path:', modalPath, err);
      if (isCurrentRequest()) abandonModalOpen(modalPath);
      return;
    }

    if (!isCurrentRequest()) {
      return;
    }

    const modalMatches = modalRouter.state.matches;
    const leafMatch = modalMatches[modalMatches.length - 1];
    if (!leafMatch) {
      console.error('[NSRouter] No modal match found for path:', modalPath);
      abandonModalOpen(modalPath);
      return;
    }

    const route = (modalRouter as any).routesById[leafMatch.routeId];
    const rawComponent = route?.options?.component;
    const Component = normalizeRenderableComponent(rawComponent);

    if (!Component) {
      console.error('[NSRouter] Invalid modal route component for route:', leafMatch.routeId, 'shape:', describeComponentShape(rawComponent), 'value:', rawComponent);
      abandonModalOpen(modalPath);
      return;
    }

    const modalPage = renderPage(modalRouter, Component, modalPath, undefined, undefined, props.debug);
    modalPageRef = modalPage;

    const resolvedModalOptions = typeof props.modalOptions === 'function' ? props.modalOptions({ modalPath, routeId: leafMatch.routeId }) : props.modalOptions;

    const resolvedIOSOptions = resolvedModalOptions?.ios;
    const detentNames = resolvedIOSOptions?.detents ?? ['medium', 'large'];
    const selectedDetent = resolvedIOSOptions?.selectedDetent ?? 'medium';
    const showGrabber = resolvedIOSOptions?.prefersGrabberVisible ?? true;
    const expandsOnScroll = resolvedIOSOptions?.prefersScrollingExpandsWhenScrolledToEdge ?? false;
    const edgeAttachedCompact = resolvedIOSOptions?.prefersEdgeAttachedInCompactHeight ?? false;
    const cornerRadius = resolvedIOSOptions?.preferredCornerRadius ?? 20;
    const transparentOnIOS26 = resolvedIOSOptions?.transparentBackgroundOnIOS26 ?? true;

    const getiOSPresentationStyle = () => {
      return resolvedIOSOptions?.presentationStyle ?? UIModalPresentationStyle.PageSheet;
    };

    const configureIOSModalSheet = () => {
      if (!__IOS__) {
        return;
      }

      const vc = modalPage?.ios || modalPage?.viewController;
      if (!vc) {
        return;
      }

      const detents = detentNames
        .map((name) => {
          if (name === 'large') {
            return UISheetPresentationControllerDetent.largeDetent();
          }

          return UISheetPresentationControllerDetent.mediumDetent();
        })
        .filter(Boolean);

      vc.modalPresentationStyle = getiOSPresentationStyle();

      const sheet = vc.sheetPresentationController || vc.parentViewController?.sheetPresentationController;
      if (!sheet) {
        return;
      }

      if (detents.length) {
        sheet.detents = Utils.ios.collections.jsArrayToNSArray(detents);
      }

      sheet.selectedDetentIdentifier = selectedDetent === 'large' ? UISheetPresentationControllerDetentIdentifierLarge : UISheetPresentationControllerDetentIdentifierMedium;
      sheet.prefersScrollingExpandsWhenScrolledToEdge = expandsOnScroll;
      sheet.prefersEdgeAttachedInCompactHeight = edgeAttachedCompact;
      sheet.prefersGrabberVisible = showGrabber;
      sheet.preferredCornerRadius = cornerRadius;

      // iOS 26+ allows transparent backgrounds so system material can show through.
      if (transparentOnIOS26 && Utils.SDK_VERSION >= 26) {
        modalPage.backgroundColor = new Color('transparent');
        if (vc.view) {
          vc.view.backgroundColor = UIColor.clearColor;
        }
      }
    };

    const showOptions: ShowModalOptions = {
      context: modalContext,
      animated: resolvedModalOptions?.animated ?? props.animated ?? true,
      fullscreen: resolvedModalOptions?.fullscreen ?? __ANDROID__,
      closeCallback: () => {
        // Closes started by the router already cleared activeModalPage.
        if (activeModalPage !== modalPage) {
          return;
        }
        activeModalPage = undefined;
        activeModalPath = null;
        modalTargetPath = null;
        syncRouterOnNativeModalClose(modalPath);
      },
    };

    if (__IOS__) {
      showOptions.ios = {
        presentationStyle: getiOSPresentationStyle(),
      };
    }

    const attemptShowModal = (hostPage: any) => {
      // The router may have moved on, or a newer open started, while this waited.
      if (!isCurrentRequest() || activeModalPage) {
        return;
      }

      try {
        log('[NSRouter] showModal attempt:', 'path=', modalPath, 'hostLoaded=', !!hostPage?.isLoaded, 'frameLoaded=', !!hostPage?.frame?.isLoaded);

        hostPage.showModal(modalPage, showOptions as any);
        activeModalPage = modalPage;
        activeModalPath = modalPath;
      } catch (err) {
        activeModalPage = undefined;
        activeModalPath = null;
        console.error('[NSRouter] Failed to show modal for path:', modalPath, err);
        abandonModalOpen(modalPath);
      }
    };

    if (__ANDROID__) {
      // Android modal dialogs rely on a ready host Page/Fragment manager.
      // Opening before the host is loaded can no-op without visual presentation.
      if (!currentPage?.isLoaded) {
        log('[NSRouter] deferring Android modal until host page is loaded:', modalPath);

        const onHostLoaded = () => {
          currentPage.removeEventListener?.('loaded', onHostLoaded);
          setTimeout(() => attemptShowModal(currentPage), 0);
        };

        currentPage.addEventListener?.('loaded', onHostLoaded);
      } else {
        setTimeout(() => attemptShowModal(currentPage), 0);
      }
    } else {
      attemptShowModal(currentPage);
      setTimeout(() => {
        if (activeModalPage !== modalPage) {
          return;
        }
        try {
          configureIOSModalSheet();
        } catch (err) {
          console.error('[NSRouter] Failed to configure iOS modal sheet:', err);
        }
      }, 0);
    }
  };

  const runNativeBackSync = () => {
    if (!router.history.canGoBack()) {
      queuedNativeBackCount = 0;
      return;
    }

    nativeBackSyncInFlight = true;
    nativeBackSyncFromPath = router.state.location.pathname;
    // Native UI has already popped the page. Reflect it in router history
    // without issuing a second Frame.goBack from the router effect.
    skipNextFrameBackNavigation = true;
    acquireGuard('native_back_callback');
    log('[NSRouter] native back pop -> router.history.back()');
    router.history.back();
  };

  const reconcileRouterToVisiblePath = (visiblePath: string, isBackNavigation: boolean) => {
    const activePath = router.state.location.pathname;
    const isRouterInitiatedBack = isBackNavigation && routerGoBackPending;
    if (isBackNavigation) {
      routerGoBackPending = false;
    }
    // A page that finished appearing may host a deferred modal.
    scheduleSync();

    if (visiblePath === activePath) {
      // Native visibility has aligned with router path, so any in-flight native
      // back sync can be deterministically completed from this event.
      if (
        shouldCompleteNativeBackSyncOnVisiblePath({
          inFlight: nativeBackSyncInFlight,
          visiblePath,
          activePath,
        })
      ) {
        nativeBackSyncInFlight = false;
        nativeBackSyncFromPath = null;
        if (guard.lockReason === 'native_back_callback') {
          log('[NSRouter] native back sync completed on visible-path alignment');
          releaseGuard();
        }
        setTimeout(tryDrainQueuedNativeBack, 0);
      }
      return;
    }

    // Only a native pop the router did not start can leave the router behind the
    // Frame. Pages the router itself pushed or popped report a stale path when
    // the router moved on during their transition; the Frame catches up instead.
    if (!isBackNavigation || isRouterInitiatedBack) {
      return;
    }

    log('[NSRouter] reconciling router to visible native page:', 'visible=', visiblePath, 'active=', activePath);

    nativeBackSyncInFlight = false;
    nativeBackSyncFromPath = null;
    queuedNativeBackCount = 0;
    skipNextFrameBackNavigation = false;

    acquireGuard('native_visible_path_reconcile');
    router.navigate({
      to: visiblePath,
      replace: true,
    } as any);

    const settlePromise = router.load?.();

    if (settlePromise && typeof settlePromise.then === 'function') {
      settlePromise
        .then(() => {
          log('[NSRouter] visible-path reconcile settled:', 'status=', router.state.status, 'path=', router.state.location.pathname);
        })
        .catch((err: any) => {
          console.error('[NSRouter] visible-path reconcile load rejected:', err);
        })
        .finally(() => {
          if (guard.lockReason === 'native_visible_path_reconcile') {
            releaseGuard();
          }
          setTimeout(tryDrainQueuedNativeBack, 0);
        });
      return;
    }

    if (guard.lockReason === 'native_visible_path_reconcile') {
      releaseGuard();
    }
    setTimeout(tryDrainQueuedNativeBack, 0);
  };

  const tryDrainQueuedNativeBack = () => {
    if (queuedNativeBackCount <= 0) {
      return;
    }

    if (nativeBackSyncInFlight || guard.isNavigating) {
      return;
    }

    if (!router.history.canGoBack()) {
      queuedNativeBackCount = 0;
      return;
    }

    queuedNativeBackCount -= 1;
    log('[NSRouter] draining queued native back sync. remaining:', queuedNativeBackCount);
    runNativeBackSync();
  };

  const loadRouter = (reason: string) => {
    // A microtask leaves whatever owner triggered the load, matching <Transitioner />.
    queueMicrotask(() => {
      router.load().catch((err: any) => {
        console.error(`[NSRouter] ${reason} load rejected:`, err);
      });
    });
  };

  // The rest of <Transitioner />: reload on history changes, plus the initial load.
  onSettled(() => {
    const unsubHistory = router.history.subscribe(() => {
      log('[NSRouter] history.subscribe fired, pathname:', router.state.location.pathname);
      loadRouter('history');
    });

    log('[NSRouter] initial load:', JSON.stringify(router.latestLocation?.pathname));
    loadRouter('initial');

    const cleanupBack = setupBackHandler(router, () => !!activeModalPage);

    // Route-file edits are hot-swapped per Page (see solid-hmr-remount.ts) so the
    // navigation stack survives the edit.
    const cleanupHmr = subscribeSolidHmrRemount({
      router,
      getFrame: () => frameRef,
      getActiveModalPage: () => activeModalPage,
      getActiveModalPath: () => activeModalPath,
      log,
    });

    return () => {
      closeModalFromRouterState();
      disposed = true;
      unsubHistory();
      cleanupBack();
      cleanupHmr();
      unsubLoad();
      unsubBeforeLoad();
      unsubResolved();
    };
  });

  // Opens/closes the native modal so it matches `?@modal=`. Opening waits until
  // the route's own Page is the visible one; its navigatedTo schedules a resync.
  const reconcileModal = (curModalPath: string | null) => {
    const historyKey = getHistoryKey(router.state.location.state);
    if (dismissedModalHistoryKey && dismissedModalHistoryKey !== historyKey) {
      dismissedModalHistoryKey = null;
    }

    if (curModalPath === modalTargetPath) {
      return;
    }

    if (modalTargetPath) {
      closeModalFromRouterState();
    }

    if (!curModalPath) {
      return;
    }

    if (dismissedModalHistoryKey) {
      return;
    }

    const hostPath = frameRef?.currentPage?.__nsRouterPath;
    if (hostPath !== router.state.location.pathname) {
      log('[NSRouter] deferring modal open until its page is visible:', curModalPath, 'visible=', hostPath);
      return;
    }

    modalTargetPath = curModalPath;
    void openModalFromRouterState(curModalPath);
  };

  const recordHistoryEntry = (index: number, kind: 'forward' | 'back' | 'replace', pathname: string, modalPath: string | null) => {
    if (kind !== 'back') {
      // A push or replace discards every entry above it.
      seenHistoryEntries.length = Math.min(seenHistoryEntries.length, index + 1);
    }
    seenHistoryEntries[index] = { pathname, modalPath };
  };

  // Nearest backstack entry showing `pathname`; router back can span several
  // entries (history.go(-n)), so popping just the top page is not enough.
  const findBackstackEntryForPath = (pathname: string) => {
    const backStack: any[] = frameRef?.backStack || [];
    for (let i = backStack.length - 1; i >= 0; i--) {
      if (backStack[i]?.resolvedPage?.__nsRouterPath === pathname) {
        return backStack[i];
      }
    }
    return undefined;
  };

  const syncFrameToRouterState = () => {
    if (disposed) {
      return;
    }
    if (!frameRef) {
      log('[NSRouter] no frameRef');
      return;
    }
    const state = router.state;
    const matches = state.matches;
    log('[NSRouter] matches:', matches.length, 'status:', state.status);
    if (!matches.length) return;

    // Release native-back sync lock only after router settles out of pending.
    if (nativeBackSyncInFlight && (state.status !== 'pending' || (nativeBackSyncFromPath != null && state.location.pathname !== nativeBackSyncFromPath))) {
      nativeBackSyncInFlight = false;
      nativeBackSyncFromPath = null;
      if (guard.lockReason === 'native_back_callback') {
        log('[NSRouter] native back callback releasing guard');
        releaseGuard();
      }
    }

    // Drain queued native-back requests one-by-one when router is stable.
    if (queuedNativeBackCount > 0) {
      tryDrainQueuedNativeBack();
    }

    const curModalPath = getSingleModalPathFromSearch(state.location.search);

    if (nativeBackSyncInFlight || guard.isNavigating) {
      // Dropping a modal never has to wait for the Frame.
      if (!curModalPath) {
        reconcileModal(null);
      }
      log('[NSRouter] Frame sync deferred until unlocked. reason:', guard.lockReason || 'native_back_in_flight');
      resyncWhenUnlocked = true;
      return;
    }

    syncFramePath(state, matches);
    reconcileModal(curModalPath);
  };

  const syncFramePath = (state: AnyRouter['state'], matches: AnyRouter['state']['matches']) => {
    // Index, key and pathname all come from the router's parsed location so they
    // describe the same entry even while history is ahead of a pending load.
    const curIndex = getHistoryIndex(state.location.state);
    const curTransition = getNativeScriptNavigationTransition(state.location.state);
    const curPathname = state.location.pathname;
    const curModalPath = getSingleModalPathFromSearch(state.location.search);
    const hasPathChanged = !shouldSkipPathNavigation(curPathname, prevPathname, prevIndex);
    const navigationKind = getNavigationKind(prevIndex, curIndex);

    log('[NSRouter] curPathname:', curPathname, 'prevPathname:', prevPathname, 'curIndex:', curIndex, 'prevIndex:', prevIndex);

    // Skip if the pathname hasn't changed (e.g., only search params changed)
    if (!hasPathChanged) {
      recordHistoryEntry(curIndex, navigationKind, curPathname, curModalPath);
      prevIndex = curIndex;
      return;
    }

    if (navigationKind === 'back') {
      if (skipNextFrameBackNavigation) {
        skipNextFrameBackNavigation = false;
        log('[NSRouter] skipping Frame.goBack for native-originated back sync');
        recordHistoryEntry(curIndex, navigationKind, curPathname, curModalPath);
        prevIndex = curIndex;
        prevPathname = curPathname;
        return;
      }

      const target = findBackstackEntryForPath(curPathname);
      if (target) {
        recordHistoryEntry(curIndex, navigationKind, curPathname, curModalPath);
        prevIndex = curIndex;
        prevPathname = curPathname;
        acquireGuard('router_state_back');
        // Router-initiated goBack causes a native navigatingFrom(back) event.
        // Suppress exactly one sync callback for this controlled pop.
        suppressedNativeBackCallbacks += 1;
        routerGoBackPending = true;
        frameRef.goBack(target);
        setTimeout(releaseGuard, 0);
        return;
      }

      // The Frame holds no page for this entry; show it in place of the current one.
      log('[NSRouter] no backstack page for', curPathname, '- replacing current page');
      if (navigateFrameTo(state, matches, curPathname, curTransition, true)) {
        recordHistoryEntry(curIndex, navigationKind, curPathname, curModalPath);
        prevIndex = curIndex;
        prevPathname = curPathname;
      }
      return;
    }

    if (navigateFrameTo(state, matches, curPathname, curTransition, navigationKind === 'replace')) {
      recordHistoryEntry(curIndex, navigationKind, curPathname, curModalPath);
      prevIndex = curIndex;
      prevPathname = curPathname;
    }
  };

  // Pushes the route's Page; returns false when it must retry once matches settle.
  const navigateFrameTo = (state: AnyRouter['state'], matches: AnyRouter['state']['matches'], curPathname: string, curTransition: ReturnType<typeof getNativeScriptNavigationTransition>, isReplace: boolean): boolean => {
    let leafMatch = matches[matches.length - 1];

    // If the leaf match's routeId doesn't match the current pathname, the matches
    // may be stale (common for child route swaps within a layout, or parameterized
    // routes like /posts/$postId where the leaf shows /posts but pathname is /posts/2).
    // Find the correct route by searching all routes for one that matches the pathname.
    if (!doesRouteIdMatchPathname(leafMatch.routeId, curPathname)) {
      const routesById = (router as any).routesById || {};
      let resolvedRouteId: string | null = null;

      // Search all routes for one whose ID pattern matches the current pathname
      for (const routeId of Object.keys(routesById)) {
        if (routeId === '__root__') continue;
        if (doesRouteIdMatchPathname(routeId, curPathname)) {
          // Prefer the most specific match (longest routeId)
          if (!resolvedRouteId || routeId.length > resolvedRouteId.length) {
            resolvedRouteId = routeId;
          }
        }
      }

      if (resolvedRouteId) {
        log('[NSRouter] match/path mismatch resolved:', leafMatch.routeId, '->', resolvedRouteId, 'for pathname:', curPathname);
        leafMatch = { ...leafMatch, routeId: resolvedRouteId };
      } else {
        if (mismatchRetryPath !== curPathname) {
          mismatchRetryPath = curPathname;
          mismatchRetries = 0;
        }
        log('[NSRouter] deferring Frame navigation due to pending match/path mismatch:', 'routeId=', leafMatch.routeId, 'pathname=', curPathname, 'status=', state.status);
        // Stores may settle on the next tick; router load events also resync.
        if (mismatchRetries < MAX_MISMATCH_RETRIES) {
          mismatchRetries += 1;
          setTimeout(scheduleSync, 16);
        }
        return false;
      }
    }
    mismatchRetries = 0;
    mismatchRetryPath = null;

    const route = (router as any).routesById[leafMatch.routeId];
    const rawComponent = route?.options?.component;
    const Component = normalizeRenderableComponent(rawComponent);

    log('[NSRouter] leafMatch:', leafMatch.routeId, 'Component:', !!Component);

    if (!Component) {
      console.error('[NSRouter] Invalid route component for route:', leafMatch.routeId, 'shape:', describeComponentShape(rawComponent), 'value:', rawComponent);
      return true;
    }

    acquireGuard('router_state_forward_or_replace');

    // Build the per-page chrome thunk (e.g. <actionbar>) for this route, if the
    // consumer supplied an `actionBar` render fn. Passed into renderPage so it renders
    // inside the page's own reactive scope and slots into page.actionBar.
    const pageChrome = props.actionBar
      ? () =>
          props.actionBar!({
            path: curPathname,
            routeId: leafMatch.routeId,
            route,
            staticData: route?.options?.staticData ?? {},
          })
      : undefined;

    // The Frame drops a page from its backstack based on that page's own entry
    // when navigating away, so a replace flags the outgoing entry.
    if (isReplace) {
      const outgoingEntry = frameRef.currentPage?.__nsRouterNavigationEntry;
      if (outgoingEntry) {
        outgoingEntry.backstackVisible = false;
      }
    }

    const navigationEntry: any = {
      create: () => {
        const page = renderPage(
          router,
          Component,
          curPathname,
          (sourcePath) => {
            if (suppressedNativeBackCallbacks > 0) {
              suppressedNativeBackCallbacks -= 1;
              log('[NSRouter] native back callback suppressed (router-initiated goBack)');
              return;
            }

            // A stale source path still indicates a real native pop event.
            // This happens when multiple native pops occur while router state is
            // still settling. Queue the sync instead of dropping it.
            if (sourcePath !== router.state.location.pathname) {
              queuedNativeBackCount += 1;
              log('[NSRouter] queued native back sync (stale source path):', 'source=', sourcePath, 'active=', router.state.location.pathname, 'count=', queuedNativeBackCount);
              setTimeout(tryDrainQueuedNativeBack, 0);
              return;
            }

            if (nativeBackSyncInFlight) {
              queuedNativeBackCount += 1;
              log('[NSRouter] queued native back sync while router is busy. count=', queuedNativeBackCount, 'status=', router.state.status);
              setTimeout(tryDrainQueuedNativeBack, 0);
              return;
            }

            log('[NSRouter] native back callback. guard:', guard.isNavigating, 'path:', router.state.location.pathname);
            const decision = getNativeBackCallbackDecision({
              guardActive: guard.isNavigating,
              canGoBack: router.history.canGoBack(),
            });
            if (decision === 'ignore_guard_active') {
              queuedNativeBackCount += 1;
              log('[NSRouter] queued native back sync (guard active). count=', queuedNativeBackCount);
              setTimeout(tryDrainQueuedNativeBack, 0);
              return;
            }

            if (decision === 'ignore_cannot_go_back') {
              log('[NSRouter] native back callback ignored (cannot go back)');
              queuedNativeBackCount = 0;
              return;
            }

            runNativeBackSync();
          },
          reconcileRouterToVisiblePath,
          props.debug,
          pageChrome,
        );
        page.__nsRouterNavigationEntry = navigationEntry;
        return page;
      },
      animated: prevIndex >= 0 ? (props.animated ?? true) : false,
      transition: curTransition ?? props.transition,
      backstackVisible: true,
      clearHistory: false,
    };

    log('[NSRouter] navigating Frame to', curPathname, isReplace ? '(replace)' : '');
    frameRef.navigate(navigationEntry);

    releaseGuard();
    return true;
  };

  createEffect(
    () => navigationSignal(),
    (signal) => {
      log('[NSRouter] effect fired, navigationSignal:', signal, 'frameRef:', !!frameRef);
      // Frame navigation renders a new Page root, and Solid forbids creating
      // ownerless roots inside an effect callback, so the sync runs right after it.
      scheduleSync();
    },
  );

  const frameEl = document.createElement('frame') as any;
  frameRef = frameEl;
  frameEl.setAttribute('actionBarVisibility', props.actionBarVisibility || 'never');
  return frameEl;
}
