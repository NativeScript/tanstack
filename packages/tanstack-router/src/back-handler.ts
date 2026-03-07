import { Application, isAndroid } from '@nativescript/core';
import type { AnyRouter } from '@tanstack/solid-router';
import type { NavigationGuard } from './types';

export function setupBackHandler(router: AnyRouter, _getFrame: () => any, _guard: NavigationGuard): () => void {
  const cleanups: Array<() => void> = [];

  if (isAndroid) {
    const handler = (args: any) => {
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
