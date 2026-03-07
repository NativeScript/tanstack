import { getSingleModalPathFromSearch } from './modal-state';
import type { NativeScriptNavigationState, NativeScriptNavigationTransition } from './types';

export const ROUTER_STATE_INDEX_KEY = '__TSR_index';
export const NS_NAVIGATION_STATE_KEY = '__nsNavigation';

export function getHistoryIndex(historyState: unknown): number {
  if (!historyState || typeof historyState !== 'object') {
    return 0;
  }

  const raw = (historyState as Record<string, unknown>)[ROUTER_STATE_INDEX_KEY];
  return typeof raw === 'number' ? raw : 0;
}

export function getNativeScriptNavigationTransition(historyState: unknown): NativeScriptNavigationTransition | undefined {
  if (!historyState || typeof historyState !== 'object') {
    return undefined;
  }

  const navigationState = historyState as NativeScriptNavigationState;
  return navigationState[NS_NAVIGATION_STATE_KEY]?.transition;
}

export function shouldSkipPathNavigation(curPathname: string, prevPathname: string, prevIndex: number): boolean {
  return curPathname === prevPathname && prevIndex >= 0;
}

export function getNavigationKind(prevIndex: number, curIndex: number): 'forward' | 'back' | 'replace' {
  if (prevIndex >= 0 && curIndex < prevIndex) {
    return 'back';
  }

  if (prevIndex >= 0 && curIndex === prevIndex) {
    return 'replace';
  }

  return 'forward';
}

export function shouldRunNativeBackSync(opts: { guardActive: boolean; canGoBack: boolean }): boolean {
  return !opts.guardActive && opts.canGoBack;
}

export function getNavigationSignalFromRouterState(state: { status?: string; location?: { search?: unknown }; matches?: Array<{ id: string }> }): string {
  const modalPath = getSingleModalPathFromSearch(state.location?.search) || '';
  const matchIds = (state.matches || []).map((m) => m.id).join(',');
  const status = state.status || '';
  return `${modalPath}|${matchIds}|${status}`;
}

function splitPath(path: string): string[] {
  if (!path || path === '/') {
    return [];
  }

  return path.split('/').filter(Boolean);
}

export function doesRouteIdMatchPathname(routeId: string, pathname: string): boolean {
  const routeSegments = splitPath(routeId);
  const pathSegments = splitPath(pathname);

  if (routeSegments.length !== pathSegments.length) {
    return false;
  }

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const pathSegment = pathSegments[i];

    if (routeSegment.startsWith('$')) {
      if (!pathSegment) {
        return false;
      }
      continue;
    }

    if (routeSegment !== pathSegment) {
      return false;
    }
  }

  return true;
}
