import { Application, isAndroid } from '@nativescript/core';
import type { AnyRouter } from '@tanstack/solid-router';

/**
 * Routes Android hardware back through router history.
 *
 * A presented modal dialog also emits `activityBackPressed`. While one is up the
 * event is left alone so the dialog dismisses itself; its close callback then
 * syncs the router, exactly like the iOS sheet swipe-down.
 */
export function setupBackHandler(router: AnyRouter, hasPresentedModal: () => boolean = () => false): () => void {
  const cleanups: Array<() => void> = [];

  if (isAndroid) {
    const handler = (args: any) => {
      if (hasPresentedModal()) {
        return;
      }

      if (router.history.canGoBack()) {
        args.cancel = true;
        router.history.back();
      }
    };
    Application.android?.on('activityBackPressed', handler);
    cleanups.push(() => {
      Application.android?.off('activityBackPressed', handler);
    });
  }

  // iOS/native page-pop sync is handled by PageRenderer's per-page navigatedTo(isBackNavigation) callback.

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
