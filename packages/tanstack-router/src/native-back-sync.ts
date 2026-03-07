export type NativeBackCallbackDecision = 'run' | 'ignore_guard_active' | 'ignore_cannot_go_back';

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
