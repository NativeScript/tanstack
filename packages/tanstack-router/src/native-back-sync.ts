export type NativeBackCallbackDecision = 'run' | 'ignore_guard_active' | 'ignore_cannot_go_back';

export interface NativeBackTimeoutReconcileOptions {
  visiblePath?: string | null;
  activePath: string;
}

export interface NativeBackVisiblePathCompletionOptions {
  inFlight: boolean;
  visiblePath: string;
  activePath: string;
}

export function getNativeBackCallbackDecision(opts: { guardActive: boolean; canGoBack: boolean }): NativeBackCallbackDecision {
  if (opts.guardActive) {
    return 'ignore_guard_active';
  }

  if (!opts.canGoBack) {
    return 'ignore_cannot_go_back';
  }

  return 'run';
}

export function shouldScheduleNativeBackSync(opts: { isBackNavigation: boolean; alreadyScheduled: boolean }): boolean {
  return opts.isBackNavigation && !opts.alreadyScheduled;
}

export function resetNativeBackSyncScheduled(): false {
  return false;
}

export function getNativeBackTimeoutReconcilePath(opts: NativeBackTimeoutReconcileOptions): string | null {
  if (typeof opts.visiblePath !== 'string') {
    return null;
  }

  const normalizedVisiblePath = opts.visiblePath.trim();
  if (!normalizedVisiblePath) {
    return null;
  }

  if (normalizedVisiblePath === opts.activePath) {
    return null;
  }

  return normalizedVisiblePath;
}

export function shouldCompleteNativeBackSyncOnVisiblePath(opts: NativeBackVisiblePathCompletionOptions): boolean {
  return opts.inFlight && opts.visiblePath === opts.activePath;
}
