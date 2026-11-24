import type { AnyRouter } from '@tanstack/solid-router';
import { normalizeRenderableComponent } from './component-shape';

type NsSolidHmrEvent = {
  kind: 'solid';
  changedFiles: string[];
  boundaries: string[];
};
type NsSolidHmrUnsubscribe = () => void;
type NsSolidHmrSubscribe = (fn: (ev: NsSolidHmrEvent) => void) => NsSolidHmrUnsubscribe;

export interface SolidHmrRemountOptions {
  router: AnyRouter;
  getFrame: () => any;
  getActiveModalPage?: () => any;
  getActiveModalPath?: () => string | null | undefined;
  log: (...args: any[]) => void;
}

// Translate a TanStack file-based route boundary path
// (e.g. `/src/routes/posts.$postId.tsx`) to its TanStack `fullPath`
// (`/posts/$postId`). Used to look up the route's freshly-patched
// component (set by the NS HMR client during boundary re-import) when a
// route file is the one that changed.
function boundaryToFullPath(bid: string): string | null {
  const m = bid.match(/\/src\/routes\/(.+)\.(tsx|jsx|ts|js)$/i);
  if (!m) return null;
  let p = m[1];
  p = p.replace(/\./g, '/');
  if (p === 'index') return '/';
  if (p.endsWith('/index')) p = p.slice(0, -6);
  p = p.replace(/(^|\/)-([\w])/g, '$1$2');
  return '/' + p;
}

// The root route (`__root__`) shares fullPath '/' with the index route, so
// prefer the non-root (leaf) match — otherwise an `index.tsx` edit would read
// the root layout's component instead of the page's. The NS HMR client patches
// `route.options.component` using the same preference, so patch + read here
// resolve to the same route.
function findRouteByFullPath(router: any, fullPath: string): any | null {
  const byId = router?.routesById;
  if (!byId) return null;
  let rootMatch: any | null = null;
  for (const rid of Object.keys(byId)) {
    const r = byId[rid];
    if (r?.fullPath !== fullPath) continue;
    if (rid === '__root__') {
      rootMatch = rootMatch || r;
      continue;
    }
    return r;
  }
  return rootMatch;
}

// Ask a Page (rendered by `PageRenderer.renderPage`) to dispose its Solid tree
// and remount, with `nextComponent` as the route component when given. Done in
// place rather than through Frame.navigate (no backstack churn, no native page
// transition).
function remountPage(page: any, nextComponent: any, log: (...a: any[]) => void): boolean {
  if (!page || typeof page.__ns_remount !== 'function') {
    return false;
  }
  try {
    page.__ns_remount(nextComponent);
    log('[NSRouter][hmr] remounted page', page.__nsRouterPath || '(unknown path)');
    return true;
  } catch (err) {
    log('[NSRouter][hmr] remount failed', err);
    return false;
  }
}

// Collect every Page currently held by the Frame (currentPage + backStack
// entries). NS Frame's backStack shape varies across runtimes/versions:
// some expose Page directly, others wrap each entry in
// { entry, resolvedPage } or `{ resolvedPage }`. We probe defensively so a
// minor shape change in @nativescript/core doesn't silently break HMR.
function collectFramePages(frame: any): any[] {
  if (!frame) return [];
  const pages: any[] = [];
  if (frame.currentPage) pages.push(frame.currentPage);
  const backStack = (frame as any).backStack;
  if (Array.isArray(backStack)) {
    for (const item of backStack) {
      if (!item) continue;
      if (item.tagName === 'page' || item.constructor?.name?.toLowerCase().includes('page')) {
        pages.push(item);
      } else if (item.entry?.resolvedPage) {
        pages.push(item.entry.resolvedPage);
      } else if (item.resolvedPage) {
        pages.push(item.resolvedPage);
      }
    }
  }
  return pages;
}

// The NS HMR client (@nativescript/vite) re-imports changed route files, patches
// `route.options.component` with the fresh export, then emits a Solid completion
// event. Every Page held by the Frame (and any open modal) is remounted on that
// event; mapping changed files to dependent pages is not worth the analysis, and
// remounting an unaffected page is cheap. Without the HMR client (production,
// tests) this is a no-op.
//
// The listener Set lives on globalThis because the HMR client and app modules
// can load as separate module instances (HTTP loader vs vendor realm).
function resolveSharedListenerSet(): Set<(ev: NsSolidHmrEvent) => void> {
  const g = globalThis as any;
  let set = g.__ns_solid_hmr_listener_set as Set<(ev: NsSolidHmrEvent) => void> | undefined;
  if (!set) {
    set = new Set<(ev: NsSolidHmrEvent) => void>();
    g.__ns_solid_hmr_listener_set = set;
  }
  return set;
}

export function subscribeSolidHmrRemount(opts: SolidHmrRemountOptions): NsSolidHmrUnsubscribe {
  const { router, getFrame, getActiveModalPage, getActiveModalPath, log } = opts;
  const g = globalThis as any;

  log('[NSRouter][hmr] subscribeSolidHmrRemount globalSubscribe=', typeof g.__ns_solid_hmr_subscribe, 'listenerSet=', typeof g.__ns_solid_hmr_listener_set);

  const listener = (ev: NsSolidHmrEvent) => {
    log('[NSRouter][hmr] event changedFiles=', ev.changedFiles, 'boundaries=', ev.boundaries);
    try {
      const tsxChanged = ev.changedFiles.filter((id) => /\.(tsx|jsx)$/i.test(id));
      if (tsxChanged.length === 0 && ev.boundaries.length === 0) {
        log('[NSRouter][hmr] no .tsx/.jsx changes; skipping remount');
        return;
      }

      // Build a routePath → freshly-patched component map for any changed
      // route files (under /src/routes/). Used as `nextComponent` hint when
      // remounting pages that match those paths.
      const routePathToComponent = new Map<string, any>();
      for (const bid of [...tsxChanged, ...ev.boundaries]) {
        const fullPath = boundaryToFullPath(bid);
        if (!fullPath) continue;
        const route = findRouteByFullPath(router, fullPath);
        const Comp = normalizeRenderableComponent(route?.options?.component);
        if (Comp) routePathToComponent.set(fullPath, Comp);
      }

      const frame = getFrame();
      const pages = collectFramePages(frame);

      let remounted = 0;
      for (const page of pages) {
        const path = page?.__nsRouterPath;
        const nextComponent = path ? routePathToComponent.get(path) : undefined;
        if (remountPage(page, nextComponent, log)) remounted++;
      }

      // Modal pages live outside the Frame. Remount any active modal too so
      // its tree picks up the edit.
      try {
        const modalPage = getActiveModalPage?.();
        const modalPath = getActiveModalPath?.();
        if (modalPage) {
          const nextComponent = modalPath ? routePathToComponent.get(modalPath) : undefined;
          remountPage(modalPage, nextComponent, log);
        }
      } catch (err) {
        log('[NSRouter][hmr] modal remount failed', err);
      }

      log('[NSRouter][hmr] event handled. tsxChanged=', tsxChanged.length, 'pages=', pages.length, 'remounted=', remounted);
    } catch (err) {
      log('[NSRouter][hmr] handler failed', err);
    }
  };

  // Prefer subscribing through the published global API so the HMR client
  // can do its own bookkeeping (count logs, etc.). Fall back to writing
  // directly into the shared global Set when the API isn't there yet —
  // that path still works because the HMR client iterates the same Set
  // at emit time.
  const subscribe = g.__ns_solid_hmr_subscribe as NsSolidHmrSubscribe | undefined;
  if (typeof subscribe === 'function') {
    log('[NSRouter][hmr] subscribed via global __ns_solid_hmr_subscribe');
    return subscribe(listener);
  }

  const set = resolveSharedListenerSet();
  set.add(listener);
  log('[NSRouter][hmr] subscribed via shared listener set (fallback). size=', set.size);
  return () => set.delete(listener);
}
