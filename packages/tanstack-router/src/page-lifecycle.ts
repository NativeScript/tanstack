export interface NavigatingFromArgs {
  isBackNavigation?: boolean;
}

// Keep page trees alive when they move to the backstack on forward navigation.
// This preserves data/UI continuity when the page is revealed again.
// Unmount only when a page is being popped by a back navigation.
export function shouldUnmountPageOnNavigatingFrom(args?: NavigatingFromArgs): boolean {
  return !!args?.isBackNavigation;
}
